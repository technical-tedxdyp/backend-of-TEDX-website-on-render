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

// // UPDATED: Initialize capacity document with 400 seats
// const initializeCapacity = async () => {
//   try {
//     const existing = await EventCapacity.findOne({ eventId: EVENT_ID });
//     if (!existing) {
//       await EventCapacity.create({
//         eventId: EVENT_ID,
//         totalSeats: 6, // CHANGED: Increased from 6 to 400
//         fullDay: 0,
//         morningSingles: 0,
//         eveningSingles: 0,
//         version: 0,
//       });
//       console.log("🚀 Initialized capacity document for", EVENT_ID, "with 400 seats");
//     } else {
//       console.log("✅ Capacity document already exists for", EVENT_ID);
//     }
//   } catch (error) {
//     console.error("❌ Failed to initialize capacity:", error.message);
//   }
// };

// // Initialize capacity on startup
// initializeCapacity();

// // UPDATED: Enhanced availability check with debugging and null safety
// async function checkSessionAvailability(session) {
//   const cap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
  
//   console.log("🔍 Checking availability:", {
//     session,
//     eventId: EVENT_ID,
//     capacityFound: !!cap,
//     totalSeats: cap?.totalSeats,
//     fullDay: cap?.fullDay,
//     morningSingles: cap?.morningSingles,
//     eveningSingles: cap?.eveningSingles,
//     version: cap?.version
//   });

//   if (!cap) {
//     console.log("❌ No capacity document found for eventId:", EVENT_ID);
//     return false;
//   }

//   // Use null coalescing to handle undefined fields gracefully
//   const morningOccupied = (cap.fullDay || 0) + (cap.morningSingles || 0);
//   const eveningOccupied = (cap.fullDay || 0) + (cap.eveningSingles || 0);
  
//   const morningAvailable = Math.max(0, (cap.totalSeats || 0) - morningOccupied);
//   const eveningAvailable = Math.max(0, (cap.totalSeats || 0) - eveningOccupied);
//   const fullDayAvailable = Math.min(morningAvailable, eveningAvailable);

//   console.log("📊 Availability calculation:", {
//     totalSeats: cap.totalSeats,
//     morningOccupied,
//     eveningOccupied,
//     morningAvailable,
//     eveningAvailable,
//     fullDayAvailable
//   });

//   let result = false;
//   switch (session) {
//     case "morning":
//       result = morningAvailable > 0;
//       console.log(`Morning session available: ${result} (${morningAvailable} seats)`);
//       break;
//     case "evening":
//       result = eveningAvailable > 0;
//       console.log(`Evening session available: ${result} (${eveningAvailable} seats)`);
//       break;
//     case "fullDay":
//       result = fullDayAvailable > 0;
//       console.log(`Full day session available: ${result} (${fullDayAvailable} seats)`);
//       break;
//     default:
//       console.log("❌ Invalid session type:", session);
//       result = false;
//   }

//   return result;
// }

// // GET /api/payment/availability
// router.get("/availability", async (req, res) => {
//   try {
//     const cap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
//     if (!cap) {
//       console.log("⚠️ No capacity document found in availability endpoint");
//       return res.status(200).json({
//         eventId: EVENT_ID,
//         totalSeats: 0,
//         fullDay: 0,
//         morningSingles: 0,
//         eveningSingles: 0,
//         morningAvailable: 0,
//         eveningAvailable: 0,
//         fullDayAvailable: 0,
//         status: "missing",
//       });
//     }

//     // Calculate based on session occupancy with null safety
//     const morningOccupied = (cap.fullDay || 0) + (cap.morningSingles || 0);
//     const eveningOccupied = (cap.fullDay || 0) + (cap.eveningSingles || 0);
    
//     const morningAvailable = Math.max(0, (cap.totalSeats || 0) - morningOccupied);
//     const eveningAvailable = Math.max(0, (cap.totalSeats || 0) - eveningOccupied);
//     const fullDayAvailable = Math.min(morningAvailable, eveningAvailable);

//     return res.status(200).json({
//       eventId: EVENT_ID,
//       totalSeats: cap.totalSeats || 0,
//       version: cap.version || 0,
//       fullDay: cap.fullDay || 0,
//       morningSingles: cap.morningSingles || 0,
//       eveningSingles: cap.eveningSingles || 0,
//       morningOccupied,
//       eveningOccupied,
//       morningAvailable,
//       eveningAvailable,
//       fullDayAvailable,
//       status: (morningAvailable > 0 || eveningAvailable > 0) ? "available" : "soldout",
//     });
//   } catch (e) {
//     console.error("Availability check error:", e?.message || e);
//     return res.status(500).json({ error: e?.message || "availability failed" });
//   }
// });

// // POST /api/payment/create-order - ENHANCED: Better availability check and error messages
// router.post("/create-order", async (req, res) => {
//   try {
//     const { amount, session } = req.body;
//     const num = Number(amount);
    
//     console.log("🎫 Create order request:", { amount, session, eventId: EVENT_ID });
    
//     if (!Number.isFinite(num) || num <= 0) {
//       console.log("❌ Invalid amount:", amount);
//       return res.status(400).json({ error: "Valid amount is required" });
//     }
    
//     if (!session || !["morning", "evening", "fullDay"].includes(session)) {
//       console.log("❌ Invalid session:", session);
//       return res.status(400).json({ error: "Valid session type is required" });
//     }

//     // CRITICAL: Check availability before creating Razorpay order
//     console.log("🔄 Checking seat availability before creating order...");
//     const isAvailable = await checkSessionAvailability(session);
    
//     if (!isAvailable) {
//       console.log("🚫 BLOCKING PAYMENT: No seats available for", session);
//       return res.status(409).json({ 
//         error: "Seats are full", 
//         message: `All seats are sold out for the ${session} session. Please try a different session.` 
//       });
//     }

//     console.log("✅ Seats available, creating Razorpay order...");
//     // Create order only if seats are available
//     const order = await createOrder(num);
//     console.log("✅ Razorpay order created:", order.id);
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

// // POST /api/payment/verify - UPDATED: Initialize with 400 seats if missing
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

//     console.log("💳 Payment verification started:", { razorpay_payment_id, session, amount });

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
//       console.log("♻️ Payment already processed:", existing.ticketId);
//       return res.json({
//         success: true,
//         message: "Payment already processed",
//         ticketId: existing.ticketId,
//         session: existing.session,
//       });
//     }

//     // UPDATED: Always ensure capacity document exists with 400 seats
//     let snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
//     if (!snap) {
//       console.log("🌱 Capacity document missing! Creating new one...");
//       try {
//         await EventCapacity.create({
//           eventId: EVENT_ID,
//           totalSeats: 6, // CHANGED: Increased from 6 to 400
//           fullDay: 0,
//           morningSingles: 0,
//           eveningSingles: 0,
//           version: 0,
//         });
//         console.log("✅ Created missing capacity document for", EVENT_ID, "with 400 seats");
//         snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
//       } catch (createError) {
//         console.error("❌ Failed to create capacity document:", createError.message);
//         return res.status(500).json({ 
//           success: false, 
//           message: "System initialization failed. Please try again." 
//         });
//       }
//     } else {
//       console.log("✅ Capacity document exists:", {
//         totalSeats: snap.totalSeats,
//         fullDay: snap.fullDay,
//         morningSingles: snap.morningSingles,
//         eveningSingles: snap.eveningSingles,
//         version: snap.version
//       });
//     }

//     // Reserve capacity and create ticket using transaction
//     let ticketDoc;
//     await withTransaction(async (txn) => {
//       try {
//         console.log("🔒 Starting transaction for seat reservation...");
        
//         // Use the reserveSeat method with optimistic concurrency control
//         const updatedCap = await EventCapacity.reserveSeat(EVENT_ID, session, txn);
//         console.log(`✅ Reserved seat for ${session}. New capacity:`, {
//           fullDay: updatedCap.fullDay,
//           morningSingles: updatedCap.morningSingles,
//           eveningSingles: updatedCap.eveningSingles,
//           version: updatedCap.version
//         });

//         const seq = await getNextSequenceValue("ticketId", txn);
//         const humanCode = `TEDX-${String(seq).padStart(5, "0")}`;

//         ticketDoc = await Ticket.create([{
//           ticketId: humanCode,
//           razorpayOrderId: razorpay_order_id,
//           razorpayPaymentId: razorpay_payment_id,
//           razorpaySignature: razorpay_signature,
//           name,
//           email: email?.toLowerCase(),
//           phone,
//           department: department || "",
//           branch: branch || "",
//           session,
//           amount: Number(amount),
//         }], { session: txn });

//         ticketDoc = ticketDoc[0]; // Extract from array when using session
//         console.log("🎫 Ticket created successfully:", humanCode);
        
//       } catch (error) {
//         console.error(`❌ Reservation failed for ${session}:`, error.message);
//         if (error.message === 'SOLD_OUT') {
//           throw new Error("SOLD_OUT");
//         }
//         if (error.message === 'EVENT_NOT_FOUND') {
//           console.error("❌ EventCapacity document missing during transaction");
//           throw new Error("SYSTEM_ERROR");
//         }
//         throw error; // Re-throw other errors
//       }
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
//       console.log("📊 Logged to Google Sheets successfully");
//     } catch (e) {
//       console.warn("⚠️ Sheets append failed (non-fatal):", e?.message || e);
//     }

//     // Success response
//     return res.json({
//       success: true,
//       message: "Payment verified; ticket will be emailed from success page",
//       ticketId: ticketDoc.ticketId,
//       session,
//       razorpayPaymentId: razorpay_payment_id,
//     });
//   } catch (err) {
//     if (err && err.message === "SOLD_OUT") {
//       console.log("🚫 Transaction failed - seats full during payment verification");
//       return res.status(409).json({ success: false, message: "Seats are full for this session" });
//     }
//     if (err && err.message === "SYSTEM_ERROR") {
//       console.log("🚫 Transaction failed - system initialization error");
//       return res.status(500).json({ success: false, message: "System error. Please contact support." });
//     }
//     if (err?.code === 11000 && err?.keyPattern?.razorpayPaymentId) {
//       const dup = await Ticket.findOne({ razorpayPaymentId: req.body.razorpay_payment_id }).lean();
//       return res.json({ success: true, message: "Payment already processed", ticketId: dup?.ticketId, session: dup?.session });
//     }
//     console.error("❌ Error verifying payment:", err?.message || err);
//     if (err?.stack) console.error(err.stack);
//     return res.status(500).json({ success: false, message: "Failed to verify payment" });
//   }
// });

// // POST /api/payment/send-ticket - Send client-generated ticket via email with Payment ID
// router.post("/send-ticket", async (req, res) => {
//   try {
//     const { 
//       email, 
//       name, 
//       session, 
//       amount, 
//       ticketId, 
//       razorpayPaymentId,
//       pdfBase64,     
//       useClientPdf,  
//       ticketImage    
//     } = req.body;

//     console.log("📧 /send-ticket called with:", {
//       email,
//       ticketId,
//       razorpayPaymentId,
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

//     await sendTicketEmail({
//       email,
//       name: name || "Guest",
//       session: session || "—",
//       amount,
//       ticketId,
//       razorpayPaymentId: razorpayPaymentId || "—",
//       ticketImage
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
//       amount: ticket.amount,
//       razorpayPaymentId: ticket.razorpayPaymentId,
//     });
//   } catch (err) {
//     console.error("Error fetching ticket:", err);
//     res.status(500).json({ error: "Failed to fetch ticket" });
//   }
// });

// module.exports = router;

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

// FIXED: Initialize capacity document with 400 seats (not 6)
const initializeCapacity = async () => {
  try {
    const existing = await EventCapacity.findOne({ eventId: EVENT_ID });
    if (!existing) {
      await EventCapacity.create({
        eventId: EVENT_ID,
        totalSeats: 400, // FIXED: Changed from 6 to 400 Vineet
        fullDay: 0,
        morningSingles: 0,
        eveningSingles: 0,
        version: 0,
      });
      console.log("🚀 Initialized capacity document for", EVENT_ID, "with 400 seats");
    } else {
      console.log("✅ Capacity document already exists for", EVENT_ID);
    }
  } catch (error) {
    console.error("❌ Failed to initialize capacity:", error.message);
  }
};

// Initialize capacity on startup
initializeCapacity();

// Enhanced availability check with debugging and null safety
async function checkSessionAvailability(session) {
  const cap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
  console.log("🔍 Checking availability:", {
    session,
    eventId: EVENT_ID,
    capacityFound: !!cap,
    totalSeats: cap?.totalSeats,
    fullDay: cap?.fullDay,
    morningSingles: cap?.morningSingles,
    eveningSingles: cap?.eveningSingles,
    version: cap?.version
  });

  if (!cap) {
    console.log("❌ No capacity document found for eventId:", EVENT_ID);
    return false;
  }

  // Use null coalescing to handle undefined fields gracefully
  const morningOccupied = (cap.fullDay || 0) + (cap.morningSingles || 0);
  const eveningOccupied = (cap.fullDay || 0) + (cap.eveningSingles || 0);
  const morningAvailable = Math.max(0, (cap.totalSeats || 0) - morningOccupied);
  const eveningAvailable = Math.max(0, (cap.totalSeats || 0) - eveningOccupied);
  const fullDayAvailable = Math.min(morningAvailable, eveningAvailable);

  console.log("📊 Availability calculation:", {
    totalSeats: cap.totalSeats,
    morningOccupied,
    eveningOccupied,
    morningAvailable,
    eveningAvailable,
    fullDayAvailable
  });

  let result = false;
  switch (session) {
    case "morning":
      result = morningAvailable > 0;
      console.log(`Morning session available: ${result} (${morningAvailable} seats)`);
      break;
    case "evening":
      result = eveningAvailable > 0;
      console.log(`Evening session available: ${result} (${eveningAvailable} seats)`);
      break;
    case "fullDay":
      result = fullDayAvailable > 0;
      console.log(`Full day session available: ${result} (${fullDayAvailable} seats)`);
      break;
    default:
      console.log("❌ Invalid session type:", session);
      result = false;
  }
  return result;
}

// GET /api/payment/availability
router.get("/availability", async (req, res) => {
  try {
    const cap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
    if (!cap) {
      console.log("⚠️ No capacity document found in availability endpoint");
      return res.status(200).json({
        eventId: EVENT_ID,
        totalSeats: 0,
        fullDay: 0,
        morningSingles: 0,
        eveningSingles: 0,
        morningAvailable: 0,
        eveningAvailable: 0,
        fullDayAvailable: 0,
        status: "missing",
      });
    }

    // Calculate based on session occupancy with null safety
    const morningOccupied = (cap.fullDay || 0) + (cap.morningSingles || 0);
    const eveningOccupied = (cap.fullDay || 0) + (cap.eveningSingles || 0);
    
    const morningAvailable = Math.max(0, (cap.totalSeats || 0) - morningOccupied);
    const eveningAvailable = Math.max(0, (cap.totalSeats || 0) - eveningOccupied);
    const fullDayAvailable = Math.min(morningAvailable, eveningAvailable);

    return res.status(200).json({
      eventId: EVENT_ID,
      totalSeats: cap.totalSeats || 0,
      version: cap.version || 0,
      fullDay: cap.fullDay || 0,
      morningSingles: cap.morningSingles || 0,
      eveningSingles: cap.eveningSingles || 0,
      morningOccupied,
      eveningOccupied,
      morningAvailable,
      eveningAvailable,
      fullDayAvailable,
      status: (morningAvailable > 0 || eveningAvailable > 0) ? "available" : "soldout",
    });
  } catch (e) {
    console.error("Availability check error:", e?.message || e);
    return res.status(500).json({ error: e?.message || "availability failed" });
  }
});

// POST /api/payment/create-order - ENHANCED: Better error handling for live keys
router.post("/create-order", async (req, res) => {
  try {
    const { amount, session, email, name } = req.body; // ADDED: email and name for better order tracking
    const num = Number(amount);
    
    console.log("🎫 Create order request:", { amount, session, eventId: EVENT_ID, email, name });
    
    if (!Number.isFinite(num) || num <= 0) {
      console.log("❌ Invalid amount:", amount);
      return res.status(400).json({ error: "Valid amount is required" });
    }
    
    if (!session || !["morning", "evening", "fullDay"].includes(session)) {
      console.log("❌ Invalid session:", session);
      return res.status(400).json({ error: "Valid session type is required" });
    }

    // CRITICAL: Check availability before creating Razorpay order
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
    
    // ENHANCED: Create order with metadata for better tracking
    const order = await createOrder(num, {
      session,
      email,
      receiptHint: session,
      ticketIntent: `${session}_ticket`
    });
    
    console.log("✅ Razorpay order created:", order.id);
    
    // CRITICAL: Return complete order details with order_id for frontend
    return res.json({
      id: order.id,           // REQUIRED for frontend
      order_id: order.id,     // ALIAS for compatibility
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      created_at: order.created_at,
      // Additional metadata for debugging
      session,
      eventId: EVENT_ID
    });
    
  } catch (err) {
    console.error("Error creating order:", err?.message || err);
    
    // ENHANCED: Better error handling for live mode authentication issues
    if (err?.message?.includes('authentication') || err?.message?.includes('Unauthorized')) {
      console.error("🚨 RAZORPAY AUTHENTICATION FAILED - Check live keys!");
      return res.status(401).json({ 
        error: "Payment gateway authentication failed",
        details: "Invalid Razorpay credentials. Please check your live keys."
      });
    }
    
    if (err?.message?.includes('invalid request') || err?.status === 400) {
      return res.status(400).json({ 
        error: "Invalid payment request",
        details: err?.message || "Request validation failed"
      });
    }
    
    return res.status(500).json({ 
      error: "Failed to create order",
      details: err?.message || "Unknown error"
    });
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

// POST /api/payment/verify - FIXED: Proper capacity initialization
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

    // Validate required fields
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
    const expected = crypto.createHmac("sha256", RZP_KEY_SECRET)
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
        razorpayPaymentId: razorpay_payment_id,
      });
    }

    // FIXED: Always ensure capacity document exists with 400 seats (not 6)
    let snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
    if (!snap) {
      console.log("🌱 Capacity document missing! Creating new one...");
      try {
        await EventCapacity.create({
          eventId: EVENT_ID,
          totalSeats: 400, // FIXED: Changed from 6 to 400 Vineet
          fullDay: 0,
          morningSingles: 0,
          eveningSingles: 0,
          version: 0,
        });
        console.log("✅ Created missing capacity document for", EVENT_ID, "with 400 seats");
        snap = await EventCapacity.findOne({ eventId: EVENT_ID }).lean();
      } catch (createError) {
        console.error("❌ Failed to create capacity document:", createError.message);
        return res.status(500).json({ 
          success: false, 
          message: "System initialization failed. Please try again." 
        });
      }
    } else {
      console.log("✅ Capacity document exists:", {
        totalSeats: snap.totalSeats,
        fullDay: snap.fullDay,
        morningSingles: snap.morningSingles,
        eveningSingles: snap.eveningSingles,
        version: snap.version
      });
    }

    // Reserve capacity and create ticket using transaction
    let ticketDoc;
    await withTransaction(async (txn) => {
      try {
        console.log("🔒 Starting transaction for seat reservation...");
        
        // ENHANCED: Better seat reservation logic
        let filter, inc;
        if (session === "fullDay") {
          filter = {
            eventId: EVENT_ID,
            $expr: {
              $and: [
                { $lt: ["$fullDay", "$totalSeats"] },
                { $lt: [{ $add: ["$fullDay", "$morningSingles"] }, "$totalSeats"] },
                { $lt: [{ $add: ["$fullDay", "$eveningSingles"] }, "$totalSeats"] },
              ],
            },
          };
          inc = { fullDay: 1 };
        } else if (session === "morning") {
          filter = {
            eventId: EVENT_ID,
            $expr: {
              $lt: [{ $add: ["$fullDay", "$morningSingles"] }, "$totalSeats"]
            },
          };
          inc = { morningSingles: 1 };
        } else {
          filter = {
            eventId: EVENT_ID,
            $expr: {
              $lt: [{ $add: ["$fullDay", "$eveningSingles"] }, "$totalSeats"]
            },
          };
          inc = { eveningSingles: 1 };
        }

        const updatedCap = await EventCapacity.findOneAndUpdate(
          filter,
          { $inc: inc },
          { new: true, session: txn }
        );

        if (!updatedCap) {
          console.error(`❌ Failed to reserve seat for ${session} - SOLD OUT`);
          throw new Error("SOLD_OUT");
        }

        console.log(`✅ Reserved seat for ${session}. New capacity:`, {
          fullDay: updatedCap.fullDay,
          morningSingles: updatedCap.morningSingles,
          eveningSingles: updatedCap.eveningSingles,
          version: updatedCap.version
        });

        const seq = await getNextSequenceValue("ticketId", txn);
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
        console.error(`❌ Reservation failed for ${session}:`, error.message);
        if (error.message === 'SOLD_OUT') {
          throw new Error("SOLD_OUT");
        }
        throw error; // Re-throw other errors
      }
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
      console.log("📊 Logged to Google Sheets successfully");
    } catch (e) {
      console.warn("⚠️ Sheets append failed (non-fatal):", e?.message || e);
    }

    // Success response
    return res.json({
      success: true,
      message: "Payment verified; ticket will be emailed from success page",
      ticketId: ticketDoc.ticketId,
      session,
      razorpayPaymentId: razorpay_payment_id,
    });

  } catch (err) {
    if (err && err.message === "SOLD_OUT") {
      console.log("🚫 Transaction failed - seats full during payment verification");
      return res.status(409).json({ success: false, message: "Seats are full for this session" });
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

// POST /api/payment/send-ticket - Send client-generated ticket via email
router.post("/send-ticket", async (req, res) => {
  try {
    const { 
      email, 
      name, 
      session, 
      amount, 
      ticketId, 
      razorpayPaymentId,
      pdfBase64,     
      useClientPdf,  
      ticketImage    
    } = req.body;

    console.log("📧 /send-ticket called with:", {
      email,
      ticketId,
      razorpayPaymentId,
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
    
    await sendTicketEmail({
      email,
      name: name || "Guest",
      session: session || "—",
      amount,
      ticketId,
      razorpayPaymentId: razorpayPaymentId || "—",
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
      razorpayPaymentId: ticket.razorpayPaymentId,
    });
  } catch (err) {
    console.error("Error fetching ticket:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

module.exports = router;
