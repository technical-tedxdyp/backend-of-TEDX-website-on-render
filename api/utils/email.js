const nodemailer = require("nodemailer");
const path = require("path");

const {
  TEDX_EMAIL_USER,
  TEDX_EMAIL_PASS,
  TEDX_SMTP_HOST,
  TEDX_SMTP_PORT,
  TEDX_SMTP_SECURE,
} = process.env;

function makeTransporter() {
  if (TEDX_SMTP_HOST && TEDX_SMTP_PORT) {
    return nodemailer.createTransport({
      host: TEDX_SMTP_HOST,
      port: Number(TEDX_SMTP_PORT),
      secure: String(TEDX_SMTP_SECURE || "true") === "true",
      auth: { user: TEDX_EMAIL_USER, pass: TEDX_EMAIL_PASS },
    });
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: TEDX_EMAIL_USER, pass: TEDX_EMAIL_PASS },
  });
}
const transporter = makeTransporter();

async function verifyTransporter() {
  try {
    if (!TEDX_EMAIL_USER || !TEDX_EMAIL_PASS) {
      console.warn(
        "⚠️ Email credentials missing. Set TEDX_EMAIL_USER and TEDX_EMAIL_PASS (or SMTP equivalents)."
      );
      return;
    }
    await transporter.verify();
    console.log("📧 Email transporter is ready");
  } catch (err) {
    console.error(
      "⚠️ Email transporter verification failed:",
      err?.message || err
    );
  }
}
verifyTransporter();

// Helper for base64 and data URI
function normalizeBase64(input = "", defaultMime = "application/octet-stream") {
  if (!input || typeof input !== "string")
    return { base64: "", mime: defaultMime };
  if (!input.startsWith("data:")) return { base64: input, mime: defaultMime };
  const [header, b64] = input.split(",");
  const mime = header?.slice(5)?.split(";")?.[0] || defaultMime;
  return { base64: b64 || "", mime };
}

// Generic sender
async function sendEmail({ to, subject, html, text, attachments }) {
  if (!TEDX_EMAIL_USER || !TEDX_EMAIL_PASS) {
    throw new Error(
      "Email credentials missing. Set TEDX_EMAIL_USER and TEDX_EMAIL_PASS (or SMTP equivalents)."
    );
  }
  if (!to) throw new Error('Email "to" is required');
  if (!subject) throw new Error('Email "subject" is required');
  if (!html && !text)
    throw new Error('Provide either "html" or "text" content');

  const mail = {
    from: `"TEDxDYPAkurdi" <${TEDX_EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    attachments: Array.isArray(attachments) ? attachments : [],
  };

  const info = await transporter.sendMail(mail);
  console.log(`✅ Email sent to ${to} (messageId: ${info.messageId})`);
  return info;
}

// UPDATED: Enhanced debugging for ticket email data
async function sendTicketEmail(ticketData = {}) {
  const {
    email,
    to,
    name,
    session,
    amount,
    ticketId,
    razorpayPaymentId,
    ticketImage, // ONLY THIS - PNG image from SuccessPage canvas
  } = ticketData;

  // CRITICAL DEBUG: Log exactly what data is received
  console.log("🔍 DEBUG - sendTicketEmail received data:", {
    email: email || to,
    name,
    session, // This should show the actual session value
    amount,
    ticketId,
    razorpayPaymentId, // This should show the actual Payment ID
    hasTicketImage: !!ticketImage,
    ticketImageType: typeof ticketImage,
    rawTicketData: ticketData, // Show all raw data
  });

  const recipient = email || to;
  if (!recipient) throw new Error("Recipient email is required");
  if (!ticketImage)
    throw new Error("ticketImage is required for email attachment");

  // ONLY PNG attachment from SuccessPage
  const { base64, mime } = normalizeBase64(ticketImage, "image/png");
  if (!base64) throw new Error("Invalid ticketImage format");

  const pngAttachment = {
    filename: `TEDx-Ticket-${ticketId || "ticket"}.png`,
    content: base64,
    encoding: "base64",
    contentType: mime || "image/png",
  };

  const safeTicketId = ticketId || "—";
  const safeName = name || "Guest";
  const safeSession = session || "—";
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : "—";
  const safePayment = razorpayPaymentId || "—";

  // ADDITIONAL DEBUG: Log the safe values being used in email
  console.log("📧 Email template will use:", {
    safeTicketId,
    safeName,
    safeSession,
    safeAmount,
    safePayment,
  });

  console.log("📸 Sending SuccessPage-generated PNG ticket via email");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;max-width:600px;margin:0 auto">
      <h2 style="margin:0 0 12px;color:#EB0028;text-align:center">Welcome to TEDxDYPAkurdi!</h2>
      <p>Dear <strong>${safeName}</strong>,</p>
      <p>Thank you for registering. Your beautifully styled ticket is attached as an image.</p>
      
      <div style="background-color:#f8f9fa;border:1px solid #e9ecef;border-radius:5px;padding:15px;margin:15px 0">
        <h3 style="margin:0 0 10px;color:#EB0028">📋 Ticket Details</h3>
        <ul style="padding-left:18px;margin:0">
          <li><strong>Ticket ID:</strong> ${safeTicketId}</li>
          <li><strong>Session:</strong> ${safeSession}</li>
          <li><strong>Amount Paid:</strong> ₹${safeAmount}</li>
        </ul>
      </div>

      <div style="background-color:#fff3cd;border:1px solid #ffeaa7;border-radius:5px;padding:15px;margin:20px 0">
        <h3 style="margin:0 0 12px;color:#856404">⚠️ Important Event Guidelines</h3>
        <p style="margin:0 0 8px;font-size:14px;color:#856404"><strong>DO'S AND DON'TS OF EVENT DAY</strong></p>
        <ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.5;color:#333">
          <li style="margin-bottom:5px">Arrive at the venue well in time. Late arrivals may cause inconvenience and will not be entertained once gates are closed.</li>
          <li style="margin-bottom:5px">Kindly occupy only the seats allotted to you by the organizing team.</li>
          <li style="margin-bottom:5px">Once the event has commenced, movement from your place is strictly prohibited. Please avoid walking in front of the stage during sessions.</li>
          <li style="margin-bottom:5px">All mobile phones must be kept on silent mode or switched off. Talking on the phone, use of flashlights, or any phone usage during TED Talks is strictly prohibited.</li>
          <li style="margin-bottom:5px">Photography is not permitted during TED Talks. Guests may take pictures only during performances, as announced by organizers.</li>
          <li style="margin-bottom:5px">Please avoid unnecessary gathering near entrance or exit areas to ensure smooth movement of all guests.</li>
          <li style="margin-bottom:5px">Silence is to be maintained at all times inside the venue. Howling, shouting, or any form of disturbance will not be tolerated, and strict action may be taken.</li>
          <li style="margin-bottom:5px">Once gates are closed, no entry or exit will be permitted until the scheduled break.</li>
          <li style="margin-bottom:5px">Guests who wish to leave the hall during permissible times are requested to use the back exit to avoid disruption.</li>
          <li style="margin-bottom:5px">Students of DYPEC will get full day attendance for 12th September the ticket as well as the hand band has to be produced as proof.</li>

        </ol>
      </div>

      <p style="background-color:#d4edda;border:1px solid #c3e6cb;border-radius:3px;padding:10px;margin:15px 0;font-size:14px">
        📱 <strong>Entry Requirements:</strong> Present this ticket image (attached) at the event for entry verification.
      </p>
      
      <p style="margin-top:20px;text-align:center">
        <strong>We look forward to seeing you at the event!</strong><br/>
        <span style="color:#666;font-size:14px">Warm regards,<br/>TEDxDYPAkurdi Team</span>
      </p>
    </div>
  `;

  return sendEmail({
    to: recipient,
    subject: "Your TEDx Ticket 🎟️ — Important Event Guidelines Inside!",
    html,
    attachments: [pngAttachment], // ONLY PNG - no PDF
  });
}

module.exports = {
  sendEmail,
  sendTicketEmail,
};
