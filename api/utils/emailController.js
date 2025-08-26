// // utils/emailController.js
// const nodemailer = require("nodemailer");
// const path = require("path");

// // Load local .env only in dev
// if (process.env.NODE_ENV !== "production") {
//   try { require("dotenv").config(); } catch (_) {}
// }

// // Optional Firebase Functions config fallback
// let ffUser, ffPass;
// try {
//   const functions = require("firebase-functions");
//   const cfg = functions.config && functions.config();
//   ffUser = cfg?.email?.user;
//   ffPass = cfg?.email?.pass;
// } catch (_) {}

// const EMAIL_USER  = process.env.TEDX_EMAIL_USER  || ffUser || "";
// const EMAIL_PASS  = process.env.TEDX_EMAIL_PASS  || ffPass || "";
// const SMTP_HOST   = process.env.TEDX_SMTP_HOST   || "";
// const SMTP_PORT   = process.env.TEDX_SMTP_PORT   || "";
// const SMTP_SECURE = String(process.env.TEDX_SMTP_SECURE || "true") === "true";

// /**
//  * Build nodemailer transporter.
//  * Prefer explicit SMTP host/port, otherwise fallback to Gmail.
//  */
// function createTransporter() {
//   if (SMTP_HOST && SMTP_PORT) {
//     return nodemailer.createTransport({
//       host: SMTP_HOST,
//       port: Number(SMTP_PORT),
//       secure: SMTP_SECURE, // true=465, false=587
//       auth: { user: EMAIL_USER, pass: EMAIL_PASS },
//     });
//   }
//   return nodemailer.createTransport({
//     service: "gmail",
//     auth: { user: EMAIL_USER, pass: EMAIL_PASS },
//   });
// }

// const transporter = createTransporter();

// // Verify transporter on startup
// (async () => {
//   if (!EMAIL_USER || !EMAIL_PASS) {
//     console.warn("⚠️ Email credentials missing. Set TEDX_EMAIL_USER and TEDX_EMAIL_PASS (or use Firebase config).");
//     return;
//   }
//   try {
//     await transporter.verify();
//     console.log("📧 Email transporter is ready");
//   } catch (e) {
//     console.warn("⚠️ Transporter verification failed:", e?.message || e);
//   }
// })();

// /**
//  * Extract base64 payload from a data URI or pass-through raw base64.
//  * Returns { base64, mime }
//  */
// function normalizeBase64(input = "", defaultMime = "application/octet-stream") {
//   if (!input || typeof input !== "string") return { base64: "", mime: defaultMime };
//   if (!input.startsWith("data:")) return { base64: input, mime: defaultMime };
//   const [header, b64] = input.split(",");
//   const mime = header?.slice(5)?.split(";")?.[0] || defaultMime;
//   return { base64: b64 || "", mime };
// }

// /**
//  * Generic email sender with flexible attachments
//  */
// async function sendEmail({ to, subject, html, text, attachment, attachments }) {
//   if (!EMAIL_USER || !EMAIL_PASS) throw new Error("Email credentials are not configured");
//   if (!to) throw new Error('Recipient "to" is required');
//   if (!subject) throw new Error('Email "subject" is required');
//   if (!html && !text) throw new Error('Provide "html" or "text" content');

//   // Normalize attachments: support both singular "attachment" and array "attachments"
//   let atts = [];
//   const a = attachments ?? attachment;
//   if (Array.isArray(a)) {
//     atts = a;
//   } else if (a instanceof Buffer) {
//     atts = [{ filename: "attachment.bin", content: a }];
//   } else if (typeof a === "string") {
//     // Treat string as file path or data URI
//     if (a.startsWith("data:")) {
//       const { base64, mime } = normalizeBase64(a);
//       if (base64) atts = [{ filename: "attachment", content: base64, encoding: "base64", contentType: mime }];
//     } else {
//       atts = [{ filename: path.basename(a), path: a }];
//     }
//   } else if (a && typeof a === "object" && (a.path || a.content)) {
//     atts = [a];
//   }

//   const mailOptions = {
//     from: `"TEDx DYP Akurdi" <${EMAIL_USER}>`,
//     to,
//     subject,
//     html,
//     text,
//     attachments: atts,
//   };

//   try {
//     const info = await transporter.sendMail(mailOptions);
//     console.log(`✅ Email sent to ${to} (messageId: ${info.messageId})`);
//     return info;
//   } catch (err) {
//     console.error(`❌ Failed to send email to ${to}:`, err?.message || err);
//     throw err;
//   }
// }

// /**
//  * Ticket sender:
//  * - Accepts either pdfBuffer (Buffer) or pdfBase64 (string without data URI)
//  * - Optionally attaches ticketImage (PNG data URI or base64)
//  * - Includes all details in the email body
//  */
// async function sendTicketEmail({
//   email,
//   to,
//   name,
//   session,
//   amount,
//   ticketId,
//   razorpayPaymentId,
//   pdfBuffer,     // preferred if available
//   pdfBase64,     // alternative if client sent base64 only (no data URI)
//   ticketImage,   // optional: data URI or base64 of PNG snapshot
// }) {
//   const recipient = email || to;
//   if (!recipient) throw new Error("Recipient email is required");

//   // Use values exactly as passed
//   const safeTicketId = (ticketId ?? "—").toString();
//   const safeName     = (name ?? "Guest").toString();
//   const safeSession  = (session ?? "—").toString(); // trust caller: send normalized session here
//   const safeAmount   = Number.isFinite(Number(amount)) ? Number(amount) : "—";
//   const safePayment  = (razorpayPaymentId ?? "—").toString();

//   // PDF attachment
//   let pdfAttachment;
//   if (pdfBuffer instanceof Buffer) {
//     pdfAttachment = {
//       filename: `TEDx-Ticket-${safeTicketId}.pdf`,
//       content: pdfBuffer,
//       contentType: "application/pdf",
//     };
//   } else if (typeof pdfBase64 === "string" && pdfBase64.trim()) {
//     pdfAttachment = {
//       filename: `TEDx-Ticket-${safeTicketId}.pdf`,
//       content: pdfBase64,
//       encoding: "base64",
//       contentType: "application/pdf",
//     };
//   } else {
//     throw new Error("Provide pdfBuffer (Buffer) or pdfBase64 (string) for ticket attachment");
//   }

//   // Optional PNG snapshot attachment (from SuccessPage canvas)
//   let pngAttachment = null;
//   if (typeof ticketImage === "string" && ticketImage.trim()) {
//     const { base64, mime } = normalizeBase64(ticketImage, "image/png");
//     if (base64) {
//       pngAttachment = {
//         filename: `Ticket-${safeTicketId}.png`,
//         content: base64,
//         encoding: "base64",
//         contentType: mime || "image/png",
//       };
//     }
//   }

//   const html = `
//     <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111">
//       <h2 style="margin:0 0 12px;color:#EB0028">Welcome to TEDx DYP Akurdi!</h2>
//       <p>Dear <strong>${safeName}</strong>,</p>
//       <p>Thank you for registering. Your ticket PDF is attached.</p>
//       <ul style="padding-left:18px;margin:12px 0">
//         <li><strong>Ticket ID:</strong> ${safeTicketId}</li>
//         <li><strong>Session:</strong> ${safeSession}</li>
//         <li><strong>Amount Paid:</strong> ₹${safeAmount}</li>
//         <li><strong>Payment ID:</strong> ${safePayment}</li>
//       </ul>
//       <p>Present this ticket (PDF or attached image) at entry.</p>
//       <p style="margin-top:16px">Best regards,<br/>TEDx DYP Akurdi Team</p>
//     </div>
//   `;

//   const atts = pngAttachment ? [pdfAttachment, pngAttachment] : [pdfAttachment];

//   return sendEmail({
//     to: recipient,
//     subject: "Your TEDx Ticket 🎟️ & Welcome!",
//     html,
//     attachments: atts,
//   });
// }

// /**
//  * Legacy helper (backward compatibility)
//  */
// async function sendEmailCompat(to, subject, html, attachmentPath) {
//   return sendEmail({ to, subject, html, attachment: attachmentPath });
// }

// module.exports = {
//   sendEmail,
//   sendEmailCompat,
//   sendTicketEmail,
// };

//=============================================================
// const nodemailer = require("nodemailer");
// const path = require("path");

// // Load .env in non‑prod
// if ((process.env.NODE_ENV || "").toLowerCase() !== "production") {
//   try { require("dotenv").config(); } catch (_) {}
// }

// // Optional Firebase Functions config fallback
// let ffUser, ffPass;
// try {
//   const functions = require("firebase-functions");
//   const cfg = functions.config && functions.config();
//   ffUser = cfg?.email?.user;
//   ffPass = cfg?.email?.pass;
// } catch (_) {}

// const EMAIL_USER  = process.env.TEDX_EMAIL_USER  || ffUser || "";
// const EMAIL_PASS  = process.env.TEDX_EMAIL_PASS  || ffPass || "";
// const SMTP_HOST   = process.env.TEDX_SMTP_HOST   || "";
// const SMTP_PORT   = process.env.TEDX_SMTP_PORT   || "";
// const SMTP_SECURE = String(process.env.TEDX_SMTP_SECURE || "true") === "true";

// function createTransporter() {
//   if (SMTP_HOST && SMTP_PORT) {
//     return nodemailer.createTransport({  // FIXED: removed "er"
//       host: SMTP_HOST,
//       port: Number(SMTP_PORT),
//       secure: SMTP_SECURE,
//       auth: { user: EMAIL_USER, pass: EMAIL_PASS },
//     });
//   }
//   return nodemailer.createTransport({  // FIXED: removed "er"
//     service: "gmail",
//     auth: { user: EMAIL_USER, pass: EMAIL_PASS },
//   });
// }

// const transporter = createTransporter();

// // Verify transporter on startup
// (async () => {
//   if (!EMAIL_USER || !EMAIL_PASS) {
//     console.warn("⚠️ Email credentials missing. Set TEDX_EMAIL_USER and TEDX_EMAIL_PASS (or use Firebase config).");
//     return;
//   }
//   try {
//     await transporter.verify();
//     console.log("📧 Email transporter is ready");
//   } catch (e) {
//     console.warn("⚠️ Transporter verification failed:", e?.message || e);
//   }
// })();

// function normalizeBase64(input = "", defaultMime = "application/octet-stream") {
//   if (!input || typeof input !== "string") return { base64: "", mime: defaultMime };
//   if (!input.startsWith("data:")) return { base64: input, mime: defaultMime };
//   const [header, b64] = input.split(",");
//   const mime = header?.slice(5)?.split(";")?.[0] || defaultMime;
//   return { base64: b64 || "", mime };
// }

// async function sendEmail({ to, subject, html, text, attachment, attachments }) {
//   if (!EMAIL_USER || !EMAIL_PASS) throw new Error("Email credentials are not configured");
//   if (!to) throw new Error('Recipient "to" is required');
//   if (!subject) throw new Error('Email "subject" is required');
//   if (!html && !text) throw new Error('Provide "html" or "text" content');

//   let atts = [];
//   const a = attachments ?? attachment;

//   if (Array.isArray(a)) {
//     atts = a;
//   } else if (a instanceof Buffer) {
//     atts = [{ filename: "attachment.bin", content: a }];
//   } else if (typeof a === "string") {
//     if (a.startsWith("data:")) {
//       const { base64, mime } = normalizeBase64(a);
//       if (base64) atts = [{ filename: "attachment", content: base64, encoding: "base64", contentType: mime }];
//     } else {
//       atts = [{ filename: path.basename(a), path: a }];
//     }
//   } else if (a && typeof a === "object" && (a.path || a.content)) {
//     atts = [a];
//   }

//   const mailOptions = {
//     from: `"TEDx DYP Akurdi" <${EMAIL_USER}>`,
//     to,
//     subject,
//     html,
//     text,
//     attachments: atts,
//   };

//   const info = await transporter.sendMail(mailOptions);
//   console.log(`✅ Email sent to ${to} (messageId: ${info.messageId})`);
//   return info;
// }

// // UPDATED: Only send PNG attachment (as requested)
// async function sendTicketEmail({
//   email,
//   to,
//   name,
//   session,
//   amount,
//   ticketId,
//   razorpayPaymentId,
//   pdfBuffer,     // IGNORED - we're only sending PNG
//   pdfBase64,     // IGNORED - we're only sending PNG
//   ticketImage,   // THIS IS WHAT WE'LL ATTACH
// }) {
//   const recipient = email || to;
//   if (!recipient) throw new Error("Recipient email is required");

//   const safeTicketId = (ticketId ?? "—").toString();
//   const safeName     = (name ?? "Guest").toString();
//   const safeSession  = (session ?? "—").toString();
//   const safeAmount   = Number.isFinite(Number(amount)) ? Number(amount) : "—";
//   const safePayment  = (razorpayPaymentId ?? "—").toString();

//   // ONLY PNG attachment (required now)
//   let pngAttachment = null;
//   if (typeof ticketImage === "string" && ticketImage.trim()) {
//     const { base64, mime } = normalizeBase64(ticketImage, "image/png");
//     if (base64) {
//       pngAttachment = {
//         filename: `TEDx-Ticket-${safeTicketId}.png`,
//         content: base64,
//         encoding: "base64",
//         contentType: mime || "image/png",
//       };
//       console.log("📸 Using client-generated PNG for email attachment");
//     }
//   }

//   if (!pngAttachment) {
//     throw new Error("ticketImage (PNG) is required for email attachment");
//   }

//   const html = `
//     <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111">
//       <h2 style="margin:0 0 12px;color:#EB0028">Welcome to TEDx DYP Akurdi!</h2>
//       <p>Dear <strong>${safeName}</strong>,</p>
//       <p>Thank you for registering. Your ticket image is attached.</p>
//       <ul style="padding-left:18px;margin:12px 0">
//         <li><strong>Ticket ID:</strong> ${safeTicketId}</li>
//         <li><strong>Session:</strong> ${safeSession}</li>
//         <li><strong>Amount Paid:</strong> ₹${safeAmount}</li>
//         <li><strong>Payment ID:</strong> ${safePayment}</li>
//       </ul>
//       <p>Present this ticket image at entry for verification.</p>
//       <p style="margin-top:16px">Best regards,<br/>TEDx DYP Akurdi Team</p>
//     </div>
//   `;

//   // ONLY PNG attachment
//   return sendEmail({
//     to: recipient,
//     subject: "Your TEDx Ticket 🎟️ & Welcome!",
//     html,
//     attachments: [pngAttachment], // Only PNG, no PDF
//   });
// }

// async function sendEmailCompat(to, subject, html, attachmentPath) {
//   return sendEmail({ to, subject, html, attachment: attachmentPath });
// }

// module.exports = {
//   sendEmail,
//   sendEmailCompat,
//   sendTicketEmail,
// };

const nodemailer = require("nodemailer");

// Environment variables for Render
const EMAIL_USER = process.env.TEDX_EMAIL_USER || "";
const EMAIL_PASS = process.env.TEDX_EMAIL_PASS || "";
const SMTP_HOST = process.env.TEDX_SMTP_HOST || "";
const SMTP_PORT = process.env.TEDX_SMTP_PORT || "";
const SMTP_SECURE = String(process.env.TEDX_SMTP_SECURE || "true") === "true";

function createTransporter() {
  if (SMTP_HOST && SMTP_PORT) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

const transporter = createTransporter();

// Verify transporter on startup
(async () => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(
      "⚠️ Email credentials missing. Set TEDX_EMAIL_USER and TEDX_EMAIL_PASS"
    );
    return;
  }
  try {
    await transporter.verify();
    console.log("📧 Email transporter is ready");
  } catch (e) {
    console.warn("⚠️ Transporter verification failed:", e?.message || e);
  }
})();

function normalizeBase64(input = "", defaultMime = "application/octet-stream") {
  if (!input || typeof input !== "string")
    return { base64: "", mime: defaultMime };
  if (!input.startsWith("data:")) return { base64: input, mime: defaultMime };
  const [header, b64] = input.split(",");
  const mime = header?.slice(5)?.split(";")?.[0] || defaultMime;
  return { base64: b64 || "", mime };
}

async function sendEmail({ to, subject, html, text, attachment, attachments }) {
  if (!EMAIL_USER || !EMAIL_PASS)
    throw new Error("Email credentials are not configured");
  if (!to) throw new Error('Recipient "to" is required');
  if (!subject) throw new Error('Email "subject" is required');
  if (!html && !text) throw new Error('Provide "html" or "text" content');

  let atts = [];
  const a = attachments ?? attachment;

  if (Array.isArray(a)) {
    atts = a;
  } else if (a instanceof Buffer) {
    atts = [{ filename: "attachment.bin", content: a }];
  } else if (typeof a === "string") {
    if (a.startsWith("data:")) {
      const { base64, mime } = normalizeBase64(a);
      if (base64)
        atts = [
          {
            filename: "attachment",
            content: base64,
            encoding: "base64",
            contentType: mime,
          },
        ];
    } else {
      atts = [{ filename: path.basename(a), path: a }];
    }
  } else if (a && typeof a === "object" && (a.path || a.content)) {
    atts = [a];
  }

  const mailOptions = {
    from: `"TEDx DYP Akurdi" <${EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    attachments: atts,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email sent to ${to} (messageId: ${info.messageId})`);
  return info;
}

// ONLY sends PNG ticket image from SuccessPage - NO PDF validation
async function sendTicketEmail({
  email,
  to,
  name,
  session,
  amount,
  ticketId,
  razorpayPaymentId,
  ticketImage, // PNG image from SuccessPage canvas
}) {
  const recipient = email || to;
  if (!recipient) throw new Error("Recipient email is required");
  if (!ticketImage) throw new Error("ticketImage is required");

  const safeTicketId = (ticketId ?? "—").toString();
  const safeName = (name ?? "Guest").toString();
  const safeSession = (session ?? "—").toString();
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : "—";
  const safePayment = (razorpayPaymentId ?? "—").toString();

  // Convert SuccessPage PNG to attachment
  const { base64, mime } = normalizeBase64(ticketImage, "image/png");
  if (!base64) throw new Error("Invalid ticketImage format");

  const pngAttachment = {
    filename: `TEDx-Ticket-${safeTicketId}.png`,
    content: base64,
    encoding: "base64",
    contentType: mime || "image/png",
  };

  console.log("📸 Sending SuccessPage-generated PNG ticket via email");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 12px;color:#EB0028">Welcome to TEDx DYP Akurdi!</h2>
      <p>Dear <strong>${safeName}</strong>,</p>
      <p>Thank you for registering. Your styled ticket is attached as an image.</p>
      <ul style="padding-left:18px;margin:12px 0">
        <li><strong>Ticket ID:</strong> ${safeTicketId}</li>
        <li><strong>Session:</strong> ${safeSession}</li>
        <li><strong>Amount Paid:</strong> ₹${safeAmount}</li>
        <li><strong>Payment ID:</strong> ${safePayment}</li>
      </ul>
      <p>Present this ticket image at the event for entry verification.</p>
      <p style="margin-top:16px">Best regards,<br/>TEDx DYP Akurdi Team</p>
    </div>
  `;

  return sendEmail({
    to: recipient,
    subject: "Your TEDx Ticket 🎟️ & Welcome!",
    html,
    attachments: [pngAttachment], // Only the styled PNG from SuccessPage
  });
}

async function sendEmailCompat(to, subject, html, attachmentPath) {
  return sendEmail({ to, subject, html, attachment: attachmentPath });
}

module.exports = {
  sendEmail,
  sendEmailCompat,
  sendTicketEmail,
};
