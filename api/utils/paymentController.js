// const express = require("express");
// const router = express.Router();
// const crypto = require("crypto");
// const { createOrder } = require("./utils/razorpayUtils");
// const Ticket = require("./models/Ticket");
// const Counter = require("./models/Counter");
// const EventCapacity = require("./models/EventCapacity");
// const { generateTicket } = require("./utils/pdfGenerator");
// const { sendEmail, sendTicketEmail } = require("./utils/email"); // UPDATED: Import sendTicketEmail
// const { appendRowToSheet } = require("./utils/googleSheetsService");
// const { connectDB, withTransaction } = require("./utils/db");

// // Ensure DB connection once
// connectDB().catch((err) => console.error("MongoDB connection error on startup:", err));

// const RZP_KEY_SECRET = process.env.TEDX_RAZORPAY_KEY_SECRET || "";
// const EVENT_ID = process.env.TEDX_EVENT_ID || "tedx-2025";
// const AUTO_SEED = String(process.env.TEDX_AUTO_SEED || "").toLowerCase() === "true";

// // GET /api/payment/availability
// router.get("/availability", async (req, res) => {
//   try {
//     const cap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
//     if (!cap) {
//       return res.status(200).json({
//         eventId: EVENT_ID,
//         totalSeats: 0,
//         totalUnits: 0,
//         usedUnits: 0,
//         fullDay: 0,
//         morningSingles: 0,
//         eveningSingles: 0,
//         morningAvailable: 0,
//         eveningAvailable: 0,
//         fullDayAvailable: 0,
//         status: "missing",
//       });
//     }
//     const morningAvailable = Math.max(0, cap.totalSeats - (cap.fullDay + cap.morningSingles));
//     const eveningAvailable = Math.max(0, cap.totalSeats - (cap.fullDay + cap.eveningSingles));
//     const fullDayAvailable = Math.min(morningAvailable, eveningAvailable);
//     return res.status(200).json({
//       eventId: EVENT_ID,
//       totalSeats: cap.totalSeats,
//       totalUnits: cap.totalUnits,
//       usedUnits: cap.usedUnits,
//       fullDay: cap.fullDay,
//       morningSingles: cap.morningSingles,
//       eveningSingles: cap.eveningSingles,
//       morningAvailable,
//       eveningAvailable,
//       fullDayAvailable,
//       status: (morningAvailable > 0 || eveningAvailable > 0 || fullDayAvailable > 0) ? "available" : "soldout",
//     });
//   } catch (e) {
//     return res.status(500).json({ error: e?.message || "availability failed" });
//   }
// });

// // POST /api/payment/create-order
// router.post("/create-order", async (req, res) => {
//   try {
//     const { amount } = req.body;
//     const num = Number(amount);
//     if (!Number.isFinite(num) || num <= 0) {
//       return res.status(400).json({ error: "Valid amount is required" });
//     }
//     const order = await createOrder(num);
//     return res.json(order);
//   } catch (err) {
//     console.error("Error creating order:", err?.message || err);
//     return res.status(500).json({ error: "Failed to create order" });
//   }
// });

// // Helper
// async function getNextSequenceValue(sequenceName, session = null) {
//   const counter = await Counter.findOneAndUpdate(
//     { _id: sequenceName },
//     { $inc: { sequence_value: 1 } },
//     { new: true, upsert: true, session: session || undefined, setDefaultsOnInsert: true }
//   );
//   return counter.sequence_value;
// }

// // POST /api/payment/verify
// router.post("/verify", async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       name,
//       email,
//       phone,
//       department,
//       branch,
//       session,
//       amount,
//     } = req.body;

//     // Basic validation + signature
//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !name || !email || !phone || !session || amount == null) {
//       return res.status(400).json({ success: false, message: "Missing required fields" });
//     }
//     if (!["morning", "evening", "fullDay"].includes(session)) {
//       return res.status(400).json({ success: false, message: "Invalid session type" });
//     }
//     if (!RZP_KEY_SECRET) {
//       return res.status(500).json({ success: false, message: "Payment secret not configured" });
//     }
//     const expected = crypto
//       .createHmac("sha256", RZP_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");
//     if (expected !== razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Invalid payment signature" });
//     }

//     // Idempotency
//     const existing = await Ticket.findOne({ razorpayPaymentId: razorpay_payment_id }).lean();
//     if (existing) {
//       return res.json({ success: true, message: "Payment already processed", ticketId: existing.ticketId, session: existing.session });
//     }

//     // Ensure capacity doc (optional dev seed)
//     const snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
//     if (!snap && AUTO_SEED) {
//       await EventCapacity.create({ eventId: EVENT_ID, totalSeats: 400, totalUnits: 800, usedUnits: 0, fullDay: 0, morningSingles: 0, eveningSingles: 0 });
//       console.log("Dev auto-seeded capacity for", EVENT_ID);
//     }

//     // Reserve + issue under txn
//     let ticketDoc;
//     await withTransaction(async (txn) => {
//       let filter, inc;
//       if (session === "fullDay") {
//         filter = {
//           eventId: EVENT_ID,
//           $expr: {
//             $and: [
//               { $lte: ["$usedUnits", { $subtract: ["$totalUnits", 2] }] },
//               { $lt: ["$fullDay", "$totalSeats"] },
//               { $lt: [{ $add: ["$fullDay", "$morningSingles"] }, "$totalSeats"] },
//               { $lt: [{ $add: ["$fullDay", "$eveningSingles"] }, "$totalSeats"] },
//             ],
//           },
//         };
//         inc = { usedUnits: 2, fullDay: 1 };
//       } else if (session === "morning") {
//         filter = {
//           eventId: EVENT_ID,
//           $expr: {
//             $and: [
//               { $lte: ["$usedUnits", { $subtract: ["$totalUnits", 1] }] },
//               { $lt: [{ $add: ["$fullDay", "$morningSingles"] }, "$totalSeats"] },
//             ],
//           },
//         };
//         inc = { usedUnits: 1, morningSingles: 1 };
//       } else {
//         filter = {
//           eventId: EVENT_ID,
//           $expr: {
//             $and: [
//               { $lte: ["$usedUnits", { $subtract: ["$totalUnits", 1] }] },
//               { $lt: [{ $add: ["$fullDay", "$eveningSingles"] }, "$totalSeats"] },
//             ],
//           },
//         };
//         inc = { usedUnits: 1, eveningSingles: 1 };
//       }
//       const cap = await EventCapacity.findOneAndUpdate(filter, { $inc: inc }, { new: true, session: txn || undefined });
//       if (!cap) throw new Error("SOLD_OUT");
//       const seq = await getNextSequenceValue("ticketId", txn || null);
//       const humanCode = `TEDX-${String(seq).padStart(5, "0")}`;
//       ticketDoc = await Ticket.create({
//         ticketId: humanCode,
//         razorpayOrderId: razorpay_order_id,
//         razorpayPaymentId: razorpay_payment_id,
//         razorpaySignature: razorpay_signature,
//         name,
//         email: email?.toLowerCase(),
//         phone,
//         department: department || "",
//         branch: branch || "",
//         session,
//         amount: Number(amount),
//       });
//     });

//     // PURE post-processing
//     try {
//       const t = (typeof ticketDoc?.toObject === "function" ? ticketDoc.toObject() : ticketDoc) || {};
//       const payload = {
//         name: t.name || name,
//         email: (t.email || email || "").toLowerCase(),
//         phone: t.phone || phone || "",
//         department: t.department || department || "",
//         branch: t.branch || branch || "",
//         session: t.session || session,
//         amount: typeof t.amount === "number" ? t.amount : Number(amount),
//         razorpayPaymentId: t.razorpayPaymentId || razorpay_payment_id,
//         ticketId: t.ticketId,
//       };

//       const pdfBuffer = await generateTicket(payload);
      
//       // UPDATED: Use sendTicketEmail instead of sendEmail
//       await sendTicketEmail({
//         email: payload.email,
//         name: payload.name,
//         session: payload.session,
//         amount: payload.amount,
//         ticketId: payload.ticketId,
//         razorpayPaymentId: payload.razorpayPaymentId,
//         pdfBuffer, // Server PDF for payment verification flow
//       });

//       // Best-effort log
//       try {
//         const createdAtISO = (t.createdAt ? new Date(t.createdAt) : new Date()).toISOString();
//         await appendRowToSheet([
//           payload.name,
//           payload.email,
//           payload.phone,
//           payload.department,
//           payload.branch,
//           payload.session,
//           payload.amount,
//           t.razorpayOrderId,
//           payload.razorpayPaymentId,
//           payload.ticketId,
//           createdAtISO,
//         ]);
//       } catch (e) {
//         console.warn("Sheets append failed (non-fatal):", e?.message || e);
//       }

//       return res.json({
//         success: true,
//         message: "Payment verified, ticket issued, and email sent",
//         ticketId: payload.ticketId,
//         session: payload.session,
//       });
//     } catch (postErr) {
//       console.error("Post-processing failed:", postErr?.message || postErr);
//       if (postErr?.stack) console.error(postErr.stack);
//       return res.status(500).json({ success: false, message: "Post-processing failed" });
//     }
//   } catch (err) {
//     if (err && err.message === "SOLD_OUT") {
//       return res.status(409).json({ success: false, message: "Sold out" });
//     }
//     if (err?.code === 11000 && err?.keyPattern?.razorpayPaymentId) {
//       const dup = await Ticket.findOne({ razorpayPaymentId: req.body.razorpay_payment_id }).lean();
//       return res.json({ success: true, message: "Payment already processed", ticketId: dup?.ticketId, session: dup?.session });
//     }
//     console.error("Error verifying payment:", err?.message || err);
//     if (err?.stack) console.error(err.stack);
//     return res.status(500).json({ success: false, message: "Failed to verify payment" });
//   }
// });

// // UPDATED: Handle client-generated PDF from SuccessPage
// router.post("/send-ticket", async (req, res) => {
//   try {
//     const { 
//       email, 
//       name, 
//       session, 
//       amount, 
//       ticketId, 
//       razorpayPaymentId,
//       pdfBase64,     // CLIENT PDF (from SuccessPage)
//       useClientPdf,  // FLAG (from SuccessPage)
//       ticketImage    // CLIENT IMAGE (from SuccessPage)
//     } = req.body;

//     if (!email || !ticketId) {
//       return res.status(400).json({ success: false, message: "Missing required fields" });
//     }

//     if (useClientPdf && pdfBase64) {
//       console.log("📧 Sending CLIENT-generated ticket via email");
      
//       // Use client PDF and image
//       await sendTicketEmail({
//         email,
//         name,
//         session,
//         amount,
//         ticketId,
//         razorpayPaymentId,
//         pdfBase64,    // CLIENT PDF
//         ticketImage   // CLIENT IMAGE
//       });
      
//     } else {
//       console.log("📧 Generating and sending SERVER ticket via email");
      
//       // Generate server PDF (fallback)
//       const pdfBuffer = await generateTicket({
//         name, 
//         email, 
//         session, 
//         amount, 
//         ticketId, 
//         razorpayPaymentId
//       });
      
//       await sendTicketEmail({
//         email,
//         name,
//         session,
//         amount,
//         ticketId,
//         razorpayPaymentId,
//         pdfBuffer     // SERVER PDF
//       });
//     }

//     return res.json({ success: true, message: "Ticket sent successfully" });
    
//   } catch (e) {
//     console.error("Error in send-ticket:", e?.message || e);
//     return res.status(500).json({ success: false, message: "Failed to send ticket" });
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { createOrder } = require("./utils/razorpayUtils");
const Ticket = require("./models/Ticket");
const Counter = require("./models/Counter");
const EventCapacity = require("./models/EventCapacity");
const { generateTicket } = require("./utils/pdfGenerator");
const { sendEmail, sendTicketEmail } = require("./utils/email");
const { appendRowToSheet } = require("./utils/googleSheetsService");
const { connectDB, withTransaction } = require("./utils/db");

// Ensure DB connection once
connectDB().catch((err) => console.error("MongoDB connection error on startup:", err));

const RZP_KEY_SECRET = process.env.TEDX_RAZORPAY_KEY_SECRET || "";
const EVENT_ID = process.env.TEDX_EVENT_ID || "tedx-2025";
const AUTO_SEED = String(process.env.TEDX_AUTO_SEED || "").toLowerCase() === "true";

// ADDED: Initialize capacity document
const initializeCapacity = async () => {
  try {
    const existing = await EventCapacity.findOne({ eventId: EVENT_ID });
    if (!existing) {
      await EventCapacity.create({
        eventId: EVENT_ID,
        totalSeats: 400, // FIXED: Set to 400 seats
        totalUnits: 800, // Keep for compatibility
        usedUnits: 0,
        fullDay: 0,
        morningSingles: 0,
        eveningSingles: 0,
      });
      console.log("🚀 Initialized capacity document for", EVENT_ID, "with 400 seats");
    }
  } catch (error) {
    console.error("❌ Failed to initialize capacity:", error.message);
  }
};

// Initialize on startup
initializeCapacity();

// ENHANCED: Availability check function
async function checkSessionAvailability(session) {
  const cap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
  if (!cap) return false;

  const morningOccupied = (cap.fullDay || 0) + (cap.morningSingles || 0);
  const eveningOccupied = (cap.fullDay || 0) + (cap.eveningSingles || 0);
  const morningAvailable = Math.max(0, (cap.totalSeats || 0) - morningOccupied);
  const eveningAvailable = Math.max(0, (cap.totalSeats || 0) - eveningOccupied);
  const fullDayAvailable = Math.min(morningAvailable, eveningAvailable);

  switch (session) {
    case "morning": return morningAvailable > 0;
    case "evening": return eveningAvailable > 0;
    case "fullDay": return fullDayAvailable > 0;
    default: return false;
  }
}

// GET /api/payment/availability
router.get("/availability", async (req, res) => {
  try {
    const cap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
    if (!cap) {
      return res.status(200).json({
        eventId: EVENT_ID,
        totalSeats: 0,
        totalUnits: 0,
        usedUnits: 0,
        fullDay: 0,
        morningSingles: 0,
        eveningSingles: 0,
        morningAvailable: 0,
        eveningAvailable: 0,
        fullDayAvailable: 0,
        status: "missing",
      });
    }

    const morningAvailable = Math.max(0, cap.totalSeats - (cap.fullDay + cap.morningSingles));
    const eveningAvailable = Math.max(0, cap.totalSeats - (cap.fullDay + cap.eveningSingles));
    const fullDayAvailable = Math.min(morningAvailable, eveningAvailable);

    return res.status(200).json({
      eventId: EVENT_ID,
      totalSeats: cap.totalSeats,
      totalUnits: cap.totalUnits || 0,
      usedUnits: cap.usedUnits || 0,
      fullDay: cap.fullDay,
      morningSingles: cap.morningSingles,
      eveningSingles: cap.eveningSingles,
      morningAvailable,
      eveningAvailable,
      fullDayAvailable,
      status: (morningAvailable > 0 || eveningAvailable > 0 || fullDayAvailable > 0) ? "available" : "soldout",
    });
  } catch (e) {
    console.error("Availability check error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "availability failed" });
  }
});

// ENHANCED: POST /api/payment/create-order - WITH CRITICAL FIXES
router.post("/create-order", async (req, res) => {
  try {
    const { amount, session, email, name } = req.body; // ADDED: session, email, name for better tracking
    const num = Number(amount);

    console.log("🎫 Create order request:", { amount, session, eventId: EVENT_ID, email, name });

    // ENHANCED: Validation
    if (!Number.isFinite(num) || num <= 0) {
      console.log("❌ Invalid amount:", amount);
      return res.status(400).json({ error: "Valid amount is required" });
    }

    // CRITICAL: Validate session for live mode
    if (!session || !["morning", "evening", "fullDay"].includes(session)) {
      console.log("❌ Invalid or missing session:", session);
      return res.status(400).json({ error: "Valid session type is required" });
    }

    // CRITICAL: Check availability BEFORE creating Razorpay order
    console.log("🔄 Checking seat availability before creating order...");
    const isAvailable = await checkSessionAvailability(session);
    
    if (!isAvailable) {
      console.log("🚫 BLOCKING PAYMENT: No seats available for", session);
      return res.status(409).json({ 
        error: "Seats are full", 
        message: `All seats are sold out for the ${session} session. Please try a different session.` 
      });
    }

    console.log("✅ Seats available, creating Razorpay order...");

    // ENHANCED: Create order with metadata
    const order = await createOrder(num, {
      session,
      email,
      receiptHint: session,
      ticketIntent: `${session}_ticket`
    });

    console.log("✅ Razorpay order created:", order.id);

    // CRITICAL: Return complete order details including order_id for frontend
    return res.json({
      id: order.id,           // REQUIRED for Razorpay checkout
      order_id: order.id,     // ALIAS for compatibility  
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      created_at: order.created_at,
      // Metadata for frontend
      session,
      eventId: EVENT_ID
    });

  } catch (err) {
    console.error("Error creating order:", err?.message || err);

    // ENHANCED: Specific error handling for live key issues
    if (err?.message?.includes('authentication') || err?.message?.includes('Unauthorized')) {
      console.error("🚨 RAZORPAY AUTHENTICATION FAILED - Check live keys!");
      return res.status(401).json({ 
        error: "Payment gateway authentication failed",
        message: "Invalid Razorpay credentials. Please verify your live API keys."
      });
    }

    if (err?.message?.includes('invalid request')) {
      return res.status(400).json({ 
        error: "Invalid payment request",
        message: err?.message || "Request validation failed"
      });
    }

    return res.status(500).json({ 
      error: "Failed to create order",
      message: err?.message || "Unknown error occurred"
    });
  }
});

// Helper function
async function getNextSequenceValue(sequenceName, session = null) {
  const counter = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true, session: session || undefined, setDefaultsOnInsert: true }
  );
  return counter.sequence_value;
}

// ENHANCED: POST /api/payment/verify - WITH BETTER ERROR HANDLING
router.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name,
      email,
      phone,
      department,
      branch,
      session,
      amount,
    } = req.body;

    console.log("💳 Payment verification started:", { 
      razorpay_payment_id, 
      razorpay_order_id, 
      session, 
      amount 
    });

    // ENHANCED: Validation with better error messages
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !name || !email || !phone || !session || amount == null) {
      console.log("❌ Missing required fields in verify request");
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!["morning", "evening", "fullDay"].includes(session)) {
      return res.status(400).json({ success: false, message: "Invalid session type" });
    }

    if (!RZP_KEY_SECRET) {
      console.error("🚨 RAZORPAY SECRET KEY MISSING!");
      return res.status(500).json({ success: false, message: "Payment secret not configured" });
    }

    // ENHANCED: Signature verification with detailed logging
    console.log("🔐 Verifying payment signature...");
    const expected = crypto
      .createHmac("sha256", RZP_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.error("❌ Payment signature verification failed!");
      console.error("Expected:", expected);
      console.error("Received:", razorpay_signature);
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    console.log("✅ Payment signature verified successfully");

    // Idempotency check
    const existing = await Ticket.findOne({ razorpayPaymentId: razorpay_payment_id }).lean();
    if (existing) {
      console.log("♻️ Payment already processed:", existing.ticketId);
      return res.json({
        success: true,
        message: "Payment already processed",
        ticketId: existing.ticketId,
        session: existing.session,
      });
    }

    // ENHANCED: Ensure capacity document exists
    let snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
    if (!snap) {
      console.log("🌱 Capacity document missing! Creating new one...");
      try {
        await EventCapacity.create({
          eventId: EVENT_ID,
          totalSeats: 400, // FIXED: 400 seats, not 0
          totalUnits: 800,
          usedUnits: 0,
          fullDay: 0,
          morningSingles: 0,
          eveningSingles: 0
        });
        console.log("✅ Created capacity document with 400 seats");
        snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
      } catch (createError) {
        console.error("❌ Failed to create capacity document:", createError.message);
        return res.status(500).json({ 
          success: false, 
          message: "System initialization failed. Please try again." 
        });
      }
    }

    // ENHANCED: Reserve + issue under transaction with better error handling
    let ticketDoc;
    await withTransaction(async (txn) => {
      try {
        let filter, inc;
        if (session === "fullDay") {
          filter = {
            eventId: EVENT_ID,
            $expr: {
              $and: [
                { $lte: ["$usedUnits", { $subtract: ["$totalUnits", 2] }] },
                { $lt: ["$fullDay", "$totalSeats"] },
                { $lt: [{ $add: ["$fullDay", "$morningSingles"] }, "$totalSeats"] },
                { $lt: [{ $add: ["$fullDay", "$eveningSingles"] }, "$totalSeats"] },
              ],
            },
          };
          inc = { usedUnits: 2, fullDay: 1 };
        } else if (session === "morning") {
          filter = {
            eventId: EVENT_ID,
            $expr: {
              $and: [
                { $lte: ["$usedUnits", { $subtract: ["$totalUnits", 1] }] },
                { $lt: [{ $add: ["$fullDay", "$morningSingles"] }, "$totalSeats"] },
              ],
            },
          };
          inc = { usedUnits: 1, morningSingles: 1 };
        } else {
          filter = {
            eventId: EVENT_ID,
            $expr: {
              $and: [
                { $lte: ["$usedUnits", { $subtract: ["$totalUnits", 1] }] },
                { $lt: [{ $add: ["$fullDay", "$eveningSingles"] }, "$totalSeats"] },
              ],
            },
          };
          inc = { usedUnits: 1, eveningSingles: 1 };
        }

        const cap = await EventCapacity.findOneAndUpdate(filter, { $inc: inc }, { new: true, session: txn || undefined });
        
        if (!cap) {
          console.error(`❌ Failed to reserve seat for ${session} - SOLD OUT`);
          throw new Error("SOLD_OUT");
        }

        console.log(`✅ Reserved seat for ${session}. Updated capacity:`, {
          totalSeats: cap.totalSeats,
          fullDay: cap.fullDay,
          morningSingles: cap.morningSingles,
          eveningSingles: cap.eveningSingles,
          usedUnits: cap.usedUnits
        });

        const seq = await getNextSequenceValue("ticketId", txn || null);
        const humanCode = `TEDX-${String(seq).padStart(5, "0")}`;

        ticketDoc = await Ticket.create([{
          ticketId: humanCode,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          name,
          email: email?.toLowerCase(),
          phone,
          department: department || "",
          branch: branch || "",
          session,
          amount: Number(amount),
        }], { session: txn });

        ticketDoc = ticketDoc[0]; // Extract from array when using session
        console.log("🎫 Ticket created successfully:", humanCode);

      } catch (error) {
        console.error(`❌ Transaction failed for ${session}:`, error.message);
        throw error; // Re-throw for outer catch
      }
    });

    // Post-processing - Generate and send ticket
    try {
      const t = (typeof ticketDoc?.toObject === "function" ? ticketDoc.toObject() : ticketDoc) || {};
      const payload = {
        name: t.name || name,
        email: (t.email || email || "").toLowerCase(),
        phone: t.phone || phone || "",
        department: t.department || department || "",
        branch: t.branch || branch || "",
        session: t.session || session,
        amount: typeof t.amount === "number" ? t.amount : Number(amount),
        razorpayPaymentId: t.razorpayPaymentId || razorpay_payment_id,
        ticketId: t.ticketId,
      };

      const pdfBuffer = await generateTicket(payload);

      // Send ticket email
      await sendTicketEmail({
        email: payload.email,
        name: payload.name,
        session: payload.session,
        amount: payload.amount,
        ticketId: payload.ticketId,
        razorpayPaymentId: payload.razorpayPaymentId,
        pdfBuffer, // Server PDF for payment verification flow
      });

      // Best-effort Google Sheets logging
      try {
        const createdAtISO = (t.createdAt ? new Date(t.createdAt) : new Date()).toISOString();
        await appendRowToSheet([
          payload.name,
          payload.email,
          payload.phone,
          payload.department,
          payload.branch,
          payload.session,
          payload.amount,
          t.razorpayOrderId,
          payload.razorpayPaymentId,
          payload.ticketId,
          createdAtISO,
        ]);
        console.log("📊 Logged to Google Sheets successfully");
      } catch (e) {
        console.warn("⚠️ Sheets append failed (non-fatal):", e?.message || e);
      }

      return res.json({
        success: true,
        message: "Payment verified, ticket issued, and email sent",
        ticketId: payload.ticketId,
        session: payload.session,
      });

    } catch (postErr) {
      console.error("Post-processing failed:", postErr?.message || postErr);
      if (postErr?.stack) console.error(postErr.stack);
      return res.status(500).json({ success: false, message: "Post-processing failed" });
    }

  } catch (err) {
    if (err && err.message === "SOLD_OUT") {
      console.log("🚫 Transaction failed - seats full during payment verification");
      return res.status(409).json({ success: false, message: "Sold out" });
    }

    if (err?.code === 11000 && err?.keyPattern?.razorpayPaymentId) {
      const dup = await Ticket.findOne({ razorpayPaymentId: req.body.razorpay_payment_id }).lean();
      return res.json({ success: true, message: "Payment already processed", ticketId: dup?.ticketId, session: dup?.session });
    }

    console.error("❌ Error verifying payment:", err?.message || err);
    if (err?.stack) console.error(err.stack);
    return res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
});

// POST /api/payment/send-ticket - Handle client-generated PDF from SuccessPage
router.post("/send-ticket", async (req, res) => {
  try {
    const { 
      email, 
      name, 
      session, 
      amount, 
      ticketId, 
      razorpayPaymentId,
      pdfBase64,     // CLIENT PDF (from SuccessPage)
      useClientPdf,  // FLAG (from SuccessPage)
      ticketImage    // CLIENT IMAGE (from SuccessPage)
    } = req.body;

    if (!email || !ticketId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (useClientPdf && pdfBase64) {
      console.log("📧 Sending CLIENT-generated ticket via email");
      
      // Use client PDF and image
      await sendTicketEmail({
        email,
        name,
        session,
        amount,
        ticketId,
        razorpayPaymentId,
        pdfBase64,    // CLIENT PDF
        ticketImage   // CLIENT IMAGE
      });
      
    } else {
      console.log("📧 Generating and sending SERVER ticket via email");
      
      // Generate server PDF (fallback)
      const pdfBuffer = await generateTicket({
        name, 
        email, 
        session, 
        amount, 
        ticketId, 
        razorpayPaymentId
      });
      
      await sendTicketEmail({
        email,
        name,
        session,
        amount,
        ticketId,
        razorpayPaymentId,
        pdfBuffer     // SERVER PDF
      });
    }

    return res.json({ success: true, message: "Ticket sent successfully" });
    
  } catch (e) {
    console.error("Error in send-ticket:", e?.message || e);
    return res.status(500).json({ success: false, message: "Failed to send ticket" });
  }
});

module.exports = router;
