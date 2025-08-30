// // utils/razorpayUtils.js
// const Razorpay = require('razorpay');
// const crypto = require('crypto');

// const RZP_KEY_ID = process.env.TEDX_RAZORPAY_KEY_ID || '';
// const RZP_KEY_SECRET = process.env.TEDX_RAZORPAY_KEY_SECRET || '';
// const CURRENCY = (process.env.TEDX_CURRENCY || 'INR').toUpperCase();
// const ENV = (process.env.NODE_ENV || 'development').toLowerCase();

// // Expose a quick readiness check for startup logs/health
// function isConfigured() {
//   return Boolean(RZP_KEY_ID && RZP_KEY_SECRET);
// }

// if (!isConfigured()) {
//   console.warn('⚠️ Razorpay keys missing: set TEDX_RAZORPAY_KEY_ID and TEDX_RAZORPAY_KEY_SECRET');
// }

// const razorpay = isConfigured()
//   ? new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET })
//   : null;

// // Normalize to integer paise.
// // Accepts:
// //  - number rupees (49) -> 4900
// //  - string rupees ("49") -> 4900
// //  - object { amountPaise: 4900 } -> 4900
// function toPaise(amount) {
//   if (amount == null) throw new Error('Amount is required');
//   if (typeof amount === 'object' && amount.amountPaise != null) {
//     const p = Number(amount.amountPaise);
//     if (!Number.isInteger(p) || p <= 0) throw new Error('Invalid amountPaise');
//     return p;
//   }
//   const num = Number(amount);
//   if (!Number.isFinite(num) || num <= 0) throw new Error('Invalid amount');
//   // Guard against floating errors: toFixed then parse
//   const rupees = Number(num.toFixed(2));
//   const paise = Math.round(rupees * 100);
//   if (!Number.isInteger(paise) || paise <= 0) throw new Error('Invalid amount after normalization');
//   return paise;
// }

// /**
//  * Create a Razorpay order.
//  * @param {number|string|{amountPaise:number}} amountInput - rupees or {amountPaise}
//  * @param {object} meta - optional metadata { receiptHint, session, email, ticketIntent }
//  */
// async function createOrder(amountInput, meta = {}) {
//   if (!razorpay) throw new Error('Razorpay not configured');

//   const amount = toPaise(amountInput);
//   // Optional guardrails: prevent absurd amounts in non-prod
//   if (ENV !== 'production' && amount > 5_00_00_000) {
//     // > ₹5,00,000 in test is suspicious
//     throw new Error('Amount too large for non-production');
//   }

//   const { receiptHint = '', session, email, ticketIntent } = meta;

//   const options = {
//     amount,
//     currency: CURRENCY,
//     // Receipt should be unique-ish; include hint for idempotency or correlation
//     receipt: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${receiptHint ? '_' + String(receiptHint).slice(0, 32) : ''}`,
//     payment_capture: 1,
//     notes: {
//       env: ENV,
//       session: session || '',
//       email: email || '',
//       ticketIntent: ticketIntent || '',
//     },
//   };

//   try {
//     const order = await razorpay.orders.create(options);
//     return order;
//   } catch (err) {
//     // Avoid logging secrets
//     const msg = err?.message || 'Unknown error';
//     const status = err?.status || err?.response?.status;
//     const data = err?.response?.data ? JSON.stringify(err.response.data).slice(0, 400) : 'n/a';
//     console.error(`Error creating Razorpay order: ${msg} (status: ${status || 'n/a'}, data: ${data})`);
//     throw err;
//   }
// }

// /**
//  * Verify Razorpay payment signature.
//  * @returns {boolean}
//  */
// function verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
//   if (!RZP_KEY_SECRET) return false;
//   if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return false;
//   const hmac = crypto.createHmac('sha256', RZP_KEY_SECRET);
//   hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
//   const expected = hmac.digest('hex');
//   return expected === razorpaySignature;
// }

// /**
//  * Compute expected signature (useful in tests).
//  */
// function computeSignature(razorpayOrderId, razorpayPaymentId) {
//   if (!RZP_KEY_SECRET) throw new Error('Razorpay secret not configured');
//   return crypto
//     .createHmac('sha256', RZP_KEY_SECRET)
//     .update(`${razorpayOrderId}|${razorpayPaymentId}`)
//     .digest('hex');
// }

// module.exports = {
//   createOrder,
//   verifyPayment,
//   computeSignature,
//   toPaise,
//   isConfigured,
// };
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Environment/config
const RZP_KEY_ID = process.env.TEDX_RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.TEDX_RAZORPAY_KEY_SECRET || "";
const CURRENCY = (process.env.TEDX_CURRENCY || "INR").toUpperCase();
const ENV = (process.env.NODE_ENV || "development").toLowerCase();

// 🔧 DEBUGGING: Log environment variables to console
console.log("🔑 Razorpay Environment Check:", {
  key_id_present: RZP_KEY_ID ? `✅ Present (${RZP_KEY_ID.slice(0, 8)}...)` : "❌ Missing",
  key_secret_present: RZP_KEY_SECRET ? `✅ Present (${RZP_KEY_SECRET.slice(0, 8)}...)` : "❌ Missing",
  currency: CURRENCY,
  env: ENV
});

// Expose a quick readiness check
function isConfigured() {
  return Boolean(RZP_KEY_ID && RZP_KEY_SECRET);
}

if (!isConfigured()) {
  console.error("❌ CRITICAL: Razorpay keys missing! Set TEDX_RAZORPAY_KEY_ID and TEDX_RAZORPAY_KEY_SECRET");
  console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes('RAZORPAY')));
}

// 🔧 FORCE CREATION: Always create Razorpay instance (will throw clear error if keys missing)
const razorpay = new Razorpay({ 
  key_id: RZP_KEY_ID, 
  key_secret: RZP_KEY_SECRET 
});

/**
 * Convert a rupee amount to integer paise with strict validation.
 */
function toPaise(amount) {
  if (amount == null) throw new Error("Amount is required");
  
  if (typeof amount === "object" && amount.amountPaise != null) {
    const p = Number(amount.amountPaise);
    if (!Number.isInteger(p) || p <= 0) throw new Error("Invalid amountPaise");
    return p;
  }
  
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid amount");
  
  const rupees = Number(num.toFixed(2));
  const paise = Math.round(rupees * 100);
  if (!Number.isInteger(paise) || paise <= 0) throw new Error("Invalid amount after normalization");
  return paise;
}

/**
 * Create a Razorpay order.
 */
async function createOrder(amountInput, meta = {}) {
  console.log("🎫 Creating Razorpay order with amount:", amountInput);
  
  const amount = toPaise(amountInput);
  
  if (ENV !== "production" && amount > 5_00_00_000) {
    throw new Error("Amount too large for non-production");
  }
  
  const { receiptHint = "", session, email, ticketIntent } = meta;
  const options = {
    amount,
    currency: CURRENCY,
    receipt: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${receiptHint ? "_" + String(receiptHint).slice(0, 32) : ""}`,
    payment_capture: 1,
    notes: {
      env: ENV,
      session: session || "",
      email: email || "",
      ticketIntent: ticketIntent || "",
    },
  };
  
  try {
    console.log("🔄 Calling razorpay.orders.create...");
    const order = await razorpay.orders.create(options);
    console.log("✅ Order created successfully:", order.id);
    return order;
  } catch (err) {
    const msg = err?.message || "Unknown error";
    const status = err?.status || err?.response?.status;
    const data = err?.response?.data ? JSON.stringify(err.response.data).slice(0, 400) : "n/a";
    console.error(`❌ Error creating Razorpay order: ${msg} (status: ${status || "n/a"}, data: ${data})`);
    throw err;
  }
}

/**
 * Verify Razorpay payment signature.
 */
function verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  if (!RZP_KEY_SECRET) return false;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return false;
  
  const hmac = crypto.createHmac("sha256", RZP_KEY_SECRET);
  hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
  const expected = hmac.digest("hex");
  return expected === razorpaySignature;
}

/**
 * Compute expected signature (useful in tests).
 */
function computeSignature(razorpayOrderId, razorpayPaymentId) {
  if (!RZP_KEY_SECRET) throw new Error("Razorpay secret not configured");
  return crypto
    .createHmac("sha256", RZP_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

module.exports = {
  createOrder,
  verifyPayment,
  computeSignature,
  toPaise,
  isConfigured,
};
