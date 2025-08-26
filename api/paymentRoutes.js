// // routes/paymentRoutes.js
// const express = require("express");
// const router = express.Router();
// const crypto = require("crypto");
// const path = require("path");
// const fs = require("fs");

// const { createOrder } = require("./utils/razorpayUtils");
// const Ticket = require("./models/Ticket");
// const Counter = require("./models/Counter");
// const EventCapacity = require("./models/EventCapacity");
// const { sendTicketEmail } = require("./utils/email");
// const { appendRowToSheet } = require("./utils/googleSheetsService");
// const { connectDB, withTransaction } = require("./utils/db");

// // Ensure DB connection once
// connectDB().catch(err => console.error("MongoDB connection error on startup:", err));

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

// // Helper: sequential ticket ids
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
//       session, // 'morning' | 'evening' | 'fullDay'
//       amount,
//     } = req.body;

//     // Validate required fields
//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !name || !email || !phone || !session || amount == null) {
//       return res.status(400).json({ success: false, message: "Missing required fields" });
//     }
//     if (!["morning", "evening", "fullDay"].includes(session)) {
//       return res.status(400).json({ success: false, message: "Invalid session type" });
//     }
//     if (!RZP_KEY_SECRET) {
//       return res.status(500).json({ success: false, message: "Payment secret not configured" });
//     }

//     // Signature verification
//     const expected = crypto.createHmac("sha256", RZP_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");
//     if (expected !== razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Invalid payment signature" });
//     }

//     // Idempotency check
//     const existing = await Ticket.findOne({ razorpayPaymentId: razorpay_payment_id }).lean();
//     if (existing) {
//       return res.json({
//         success: true,
//         message: "Payment already processed",
//         ticketId: existing.ticketId,
//         session: existing.session,
//       });
//     }

//     // Ensure capacity document exists (dev mode)
//     const snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
//     if (!snap && AUTO_SEED) {
//       await EventCapacity.create({
//         eventId: EVENT_ID,
//         totalSeats: 400,
//         totalUnits: 800,
//         usedUnits: 0,
//         fullDay: 0,
//         morningSingles: 0,
//         eveningSingles: 0,
//       });
//       console.log("Dev auto-seeded capacity for", EVENT_ID);
//     }

//     // Reserve capacity and create ticket in transaction
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

//       const cap = await EventCapacity.findOneAndUpdate(
//         filter,
//         { $inc: inc },
//         { new: true, session: txn || undefined }
//       );
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

//     // Log to Google Sheets (best effort)
//     try {
//       const t = (typeof ticketDoc?.toObject === "function" ? ticketDoc.toObject() : ticketDoc) || {};
//       const createdAtISO = (t.createdAt ? new Date(t.createdAt) : new Date()).toISOString();
//       await appendRowToSheet([
//         t.name || name,
//         (t.email || email || "").toLowerCase(),
//         t.phone || phone || "",
//         t.department || department || "",
//         t.branch || branch || "",
//         t.session || session,
//         typeof t.amount === "number" ? t.amount : Number(amount),
//         t.razorpayOrderId || razorpay_order_id,
//         t.razorpayPaymentId || razorpay_payment_id,
//         t.ticketId,
//         createdAtISO,
//       ]);
//     } catch (e) {
//       console.warn("Sheets append failed (non-fatal):", e?.message || e);
//     }

//     // Success response - SuccessPage will handle email sending
//     return res.json({
//       success: true,
//       message: "Payment verified; ticket will be emailed from success page",
//       ticketId: ticketDoc.ticketId,
//       session,
//       razorpayPaymentId: razorpay_payment_id,
//     });
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

// // POST /api/payment/send-ticket - Send client-generated ticket via email
// router.post("/send-ticket", async (req, res) => {
//   try {
//     const {
//       email,
//       name,
//       session,
//       amount,
//       ticketId,
//       razorpayPaymentId,
//       pdfBase64,     // CLIENT PDF (saved to disk only)
//       useClientPdf,  // FLAG
//       ticketImage    // CLIENT PNG (emailed)
//     } = req.body;

//     console.log("📧 /send-ticket called with:", {
//       email,
//       ticketId,
//       useClientPdf,
//       hasPdfBase64: !!pdfBase64,
//       hasTicketImage: !!ticketImage
//     });

//     // Validate required fields
//     if (!email || !ticketId) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: email and ticketId"
//       });
//     }

//     // Ensure we have client-generated content
//     if (!useClientPdf || !ticketImage) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing client-generated content: useClientPdf and ticketImage required"
//       });
//     }

//     console.log("📧 Sending CLIENT-generated ticket via email");

//     // Send email with PNG image attachment only
//     await sendTicketEmail({
//       email,
//       name: name || "Guest",
//       session: session || "—",
//       amount,
//       ticketId,
//       razorpayPaymentId,
//       ticketImage    // Only PNG image - no PDF
//     });

//     // Save PDF to disk for backup/audit (optional)
//     if (pdfBase64) {
//       try {
//         const ticketsDir = path.join(__dirname, "..", "tickets");
//         if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir, { recursive: true });
//         const filePath = path.join(ticketsDir, `TEDx-Ticket-${ticketId}.pdf`);
//         const pdfBuffer = Buffer.from(pdfBase64, "base64");
//         fs.writeFileSync(filePath, pdfBuffer);
//         console.log("💾 Saved client PDF to", filePath);
//       } catch (e) {
//         console.warn("⚠ Could not save PDF to disk:", e?.message || e);
//       }
//     }

//     return res.json({
//       success: true,
//       message: "Client-generated ticket sent via email successfully"
//     });
    
//   } catch (e) {
//     console.error("Error in send-ticket:", e?.message || e);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to send ticket: " + (e?.message || "Unknown error")
//     });
//   }
// });

// // GET /api/tickets/:ticketId - Get ticket info for session recovery
// router.get("/tickets/:ticketId", async (req, res) => {
//   try {
//     const { ticketId } = req.params;
//     const ticket = await Ticket.findOne({ ticketId }).lean();
    
//     if (!ticket) {
//       return res.status(404).json({ error: "Ticket not found" });
//     }
    
//     res.json({
//       ticketId: ticket.ticketId,
//       session: ticket.session,
//       name: ticket.name,
//       email: ticket.email,
//       phone: ticket.phone,
//       amount: ticket.amount
//     });
//   } catch (err) {
//     console.error("Error fetching ticket:", err);
//     res.status(500).json({ error: "Failed to fetch ticket" });
//   }
// });

// module.exports = router;

// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const { createOrder } = require("./utils/razorpayUtils");
const Ticket = require("./models/Ticket");
const Counter = require("./models/Counter");
const EventCapacity = require("./models/EventCapacity");
const { sendTicketEmail } = require("./utils/email");
const { appendRowToSheet } = require("./utils/googleSheetsService");
const { connectDB, withTransaction } = require("./utils/db");

// Ensure DB connection once
connectDB().catch(err => console.error("MongoDB connection error on startup:", err));

const RZP_KEY_SECRET = process.env.TEDX_RAZORPAY_KEY_SECRET || "";
const EVENT_ID = process.env.TEDX_EVENT_ID || "tedx-2025";
const AUTO_SEED = String(process.env.TEDX_AUTO_SEED || "").toLowerCase() === "true";

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
      totalUnits: cap.totalUnits,
      usedUnits: cap.usedUnits,
      fullDay: cap.fullDay,
      morningSingles: cap.morningSingles,
      eveningSingles: cap.eveningSingles,
      morningAvailable,
      eveningAvailable,
      fullDayAvailable,
      status: (morningAvailable > 0 || eveningAvailable > 0 || fullDayAvailable > 0) ? "available" : "soldout",
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "availability failed" });
  }
});

// POST /api/payment/create-order
router.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }
    const order = await createOrder(num);
    return res.json(order);
  } catch (err) {
    console.error("Error creating order:", err?.message || err);
    return res.status(500).json({ error: "Failed to create order" });
  }
});

// Helper: sequential ticket ids
async function getNextSequenceValue(sequenceName, session = null) {
  const counter = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true, session: session || undefined, setDefaultsOnInsert: true }
  );
  return counter.sequence_value;
}

// POST /api/payment/verify
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
      session, // 'morning' | 'evening' | 'fullDay'
      amount,
    } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !name || !email || !phone || !session || amount == null) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (!["morning", "evening", "fullDay"].includes(session)) {
      return res.status(400).json({ success: false, message: "Invalid session type" });
    }
    if (!RZP_KEY_SECRET) {
      return res.status(500).json({ success: false, message: "Payment secret not configured" });
    }

    // Signature verification
    const expected = crypto.createHmac("sha256", RZP_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Idempotency check
    const existing = await Ticket.findOne({ razorpayPaymentId: razorpay_payment_id }).lean();
    if (existing) {
      return res.json({
        success: true,
        message: "Payment already processed",
        ticketId: existing.ticketId,
        session: existing.session,
      });
    }

    // Ensure capacity document exists (dev mode)
    const snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
    if (!snap && AUTO_SEED) {
      await EventCapacity.create({
        eventId: EVENT_ID,
        totalSeats: 400,
        totalUnits: 800,
        usedUnits: 0,
        fullDay: 0,
        morningSingles: 0,
        eveningSingles: 0,
      });
      console.log("Dev auto-seeded capacity for", EVENT_ID);
    }

    // Reserve capacity and create ticket in transaction
    let ticketDoc;
    await withTransaction(async (txn) => {
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

      const cap = await EventCapacity.findOneAndUpdate(
        filter,
        { $inc: inc },
        { new: true, session: txn || undefined }
      );
      if (!cap) throw new Error("SOLD_OUT");

      const seq = await getNextSequenceValue("ticketId", txn || null);
      const humanCode = `TEDX-${String(seq).padStart(5, "0")}`;

      ticketDoc = await Ticket.create({
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
      });
    });

    // Log to Google Sheets (best effort)
    try {
      const t = (typeof ticketDoc?.toObject === "function" ? ticketDoc.toObject() : ticketDoc) || {};
      const createdAtISO = (t.createdAt ? new Date(t.createdAt) : new Date()).toISOString();
      await appendRowToSheet([
        t.name || name,
        (t.email || email || "").toLowerCase(),
        t.phone || phone || "",
        t.department || department || "",
        t.branch || branch || "",
        t.session || session,
        typeof t.amount === "number" ? t.amount : Number(amount),
        t.razorpayOrderId || razorpay_order_id,
        t.razorpayPaymentId || razorpay_payment_id,
        t.ticketId,
        createdAtISO,
      ]);
    } catch (e) {
      console.warn("Sheets append failed (non-fatal):", e?.message || e);
    }

    // Success response - SuccessPage will handle email sending
    return res.json({
      success: true,
      message: "Payment verified; ticket will be emailed from success page",
      ticketId: ticketDoc.ticketId,
      session,
      razorpayPaymentId: razorpay_payment_id, // CRITICAL: Include this for SuccessPage
    });
  } catch (err) {
    if (err && err.message === "SOLD_OUT") {
      return res.status(409).json({ success: false, message: "Sold out" });
    }
    if (err?.code === 11000 && err?.keyPattern?.razorpayPaymentId) {
      const dup = await Ticket.findOne({ razorpayPaymentId: req.body.razorpay_payment_id }).lean();
      return res.json({ success: true, message: "Payment already processed", ticketId: dup?.ticketId, session: dup?.session });
    }
    console.error("Error verifying payment:", err?.message || err);
    if (err?.stack) console.error(err.stack);
    return res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
});

// POST /api/payment/send-ticket - FIXED: Send client-generated ticket via email with Payment ID
router.post("/send-ticket", async (req, res) => {
  try {
    const { 
      email, 
      name, 
      session, 
      amount, 
      ticketId, 
      razorpayPaymentId,  // CRITICAL: Extract this from request body
      pdfBase64,     
      useClientPdf,  
      ticketImage    
    } = req.body;

    // ENHANCED DEBUG: Include razorpayPaymentId in logs
    console.log("📧 /send-ticket called with:", {
      email,
      ticketId,
      razorpayPaymentId,  // ADDED: This will show if Payment ID is received
      useClientPdf,
      hasPdfBase64: !!pdfBase64,
      hasTicketImage: !!ticketImage
    });

    // Validate required fields
    if (!email || !ticketId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: email and ticketId" 
      });
    }

    // Ensure we have client-generated content
    if (!useClientPdf || !ticketImage) {
      return res.status(400).json({
        success: false,
        message: "Missing client-generated content: useClientPdf and ticketImage required"
      });
    }

    console.log("📧 Sending CLIENT-generated ticket via email");

    // CRITICAL FIX: Pass razorpayPaymentId to email function
    await sendTicketEmail({
      email,
      name: name || "Guest",
      session: session || "—",
      amount,
      ticketId,
      razorpayPaymentId: razorpayPaymentId || "—", // FIXED: Now passes Payment ID
      ticketImage
    });

    // Save PDF to disk for backup/audit (optional)
    if (pdfBase64) {
      try {
        const ticketsDir = path.join(__dirname, "..", "tickets");
        if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir, { recursive: true });
        const filePath = path.join(ticketsDir, `TEDx-Ticket-${ticketId}.pdf`);
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        fs.writeFileSync(filePath, pdfBuffer);
        console.log("💾 Saved client PDF to", filePath);
      } catch (e) {
        console.warn("⚠ Could not save PDF to disk:", e?.message || e);
      }
    }

    return res.json({ 
      success: true, 
      message: "Client-generated ticket sent via email successfully" 
    });
    
  } catch (e) {
    console.error("Error in send-ticket:", e?.message || e);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to send ticket: " + (e?.message || "Unknown error")
    });
  }
});

// GET /api/tickets/:ticketId - Get ticket info for session recovery
router.get("/tickets/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findOne({ ticketId }).lean();
    
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    res.json({
      ticketId: ticket.ticketId,
      session: ticket.session,
      name: ticket.name,
      email: ticket.email,
      phone: ticket.phone,
      amount: ticket.amount,
      razorpayPaymentId: ticket.razorpayPaymentId, // ADDED: Include Payment ID in response
    });
  } catch (err) {
    console.error("Error fetching ticket:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

module.exports = router;
