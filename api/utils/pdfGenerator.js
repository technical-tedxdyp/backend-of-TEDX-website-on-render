// const PDFDocument = require("pdfkit");
// const QRCode = require("qrcode");
// const fs = require("fs");
// const path = require("path");

// function tryRead(p) { try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch (_) {} return null; }
// function dataUrlToBuffer(dataUrl) {
//   if (typeof dataUrl !== "string") return null;
//   const i = dataUrl.indexOf(",");
//   if (i < 0) return null;
//   return Buffer.from(dataUrl.slice(i + 1), "base64");
// }
// function normalizeSession(v) {
//   const s = String(v ?? "").trim();
//   if (!s) return "—";
//   const lower = s.toLowerCase();
//   if (lower === "morning") return "Morning";
//   if (lower === "evening") return "Evening";
//   if (lower === "fullday" || lower === "full day" || lower === "full_day" || lower === "full-day" || lower === "full" || lower === "fullday session" || lower === "full day session" || lower === "fulldayticket" || lower === "fulldaypass" || lower === "full pass" || lower === "fullDay".toLowerCase()) return "Full Day";
//   if (lower.includes("morning")) return "Morning";
//   if (lower.includes("evening")) return "Evening";
//   if (lower.includes("full")) return "Full Day";
//   return s;
// }

// /**
//  * ticketData: { name, email, phone, session, amount, razorpayPaymentId, ticketId }
//  */
// async function generateTicket(ticketData) {
//   if (!ticketData || typeof ticketData !== "object") throw new Error("ticketData is required");

//   const safe = {
//     name: String(ticketData.name ?? "").trim() || "—",
//     email: String(ticketData.email ?? "").trim() || "—",
//     phone: String(ticketData.phone ?? "").trim() || "—",
//     session: String(ticketData.session ?? "").trim(), // raw
//     ticketId: String(ticketData.ticketId ?? "").trim() || "—",
//     razorpayPaymentId: String(ticketData.razorpayPaymentId ?? "").trim() || "—",
//     amount: Number.isFinite(Number(ticketData.amount)) ? Number(ticketData.amount) : "—",
//   };

//   const sessionLabel = normalizeSession(safe.session);
//   const amountStr = safe.amount === "—" ? "—" : `₹ ${safe.amount}`;

//   return new Promise(async (resolve, reject) => {
//     try {
//       const doc = new PDFDocument({ size: [500, 220], margin: 0 });
//       const chunks = [];
//       doc.on("data", c => chunks.push(c));
//       doc.on("end", () => resolve(Buffer.concat(chunks)));
//       doc.on("error", reject);

//       const assetsDir = path.join(__dirname, "assets");
//       const xImg = tryRead(path.join(assetsDir, "tedx-x-art.png"));
//       const sunBg = tryRead(path.join(assetsDir, "sun-bg.png"));
//       const igIcon = tryRead(path.join(assetsDir, "ig.png"));
//       const fontReg = tryRead(path.join(assetsDir, "Inter-Regular.ttf")) || tryRead(path.join(assetsDir, "Helvetica.ttf"));
//       const fontBold = tryRead(path.join(assetsDir, "Inter-Bold.ttf")) || fontReg;
//       if (fontReg) doc.registerFont("REG", fontReg);
//       if (fontBold) doc.registerFont("BOLD", fontBold);

//       // Left panel
//       doc.save();
//       doc.roundedRect(10, 10, 320, 200, 14).fill("#BE2326");
//       if (sunBg) { doc.opacity(0.3).image(sunBg, 10, 10, { width: 320, height: 200 }); doc.opacity(1); }

//       // Header
//       doc.font(fontBold ? "BOLD" : "Helvetica-Bold").fontSize(26).fillColor("#fff").text("TED", 26, 28, { continued: true });
//       doc.fillColor("#EB0028").text("x", { continued: true });
//       doc.fillColor("#fff").text("DYPAkurdi");
//       doc.font(fontReg ? "REG" : "Helvetica").fontSize(11).fillColor("#fff").text("x = Independently Organized TED Event", 26, 51);

//       // Price
//       doc.fontSize(22).fillColor("#fff").text(amountStr, 270, 28, { align: "right" });

//       // Details
//       const details = [
//         { label: "Name", value: safe.name },
//         { label: "Email", value: safe.email },
//         { label: "Phone", value: safe.phone },
//         { label: "Session", value: sessionLabel },
//         { label: "Ticket ID", value: safe.ticketId },
//       ];
//       let y = 85;
//       for (const { label, value } of details) {
//         doc.font(fontBold ? "BOLD" : "Helvetica-Bold").fontSize(13).fillColor("#fff").text(`${label} : `, 26, y, { continued: true });
//         doc.font(fontReg ? "REG" : "Helvetica").text(String(value));
//         y += 22;
//       }

//       if (igIcon) { doc.image(igIcon, 26, 182, { width: 16, height: 16 }); doc.fontSize(10).fillColor("#fff").font(fontReg ? "REG" : "Helvetica").text("tedxdypakurdi", 48, 186); }
//       doc.restore();

//       // Right art
//       if (xImg) doc.image(xImg, 340, 36, { width: 125, height: 145 });
//       else doc.font(fontBold ? "BOLD" : "Helvetica-Bold").fontSize(140).fillColor("#EB0028").text("X", 355, 73);

//       // QR payload
//       const issuedAt = new Date().toISOString();
//       const qrPayloadLines = [
//         `Name:${safe.name}`,
//         `Email:${safe.email}`,
//         `Phone:${safe.phone}`,
//         `Session:${sessionLabel}`,
//         `Amount:${amountStr}`,
//         `TicketID:${safe.ticketId}`,
//         `PaymentID:${safe.razorpayPaymentId}`,
//         `IssuedAt:${issuedAt}`,
//       ];
//       const qrData = qrPayloadLines.join("\n");

//       try {
//         const dataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 80 });
//         const qrBuffer = dataUrlToBuffer(dataUrl);
//         if (qrBuffer) doc.image(qrBuffer, 400, 150, { width: 80, height: 80 });
//         else {
//           doc.rect(400, 150, 80, 80).strokeColor("#ffffff").lineWidth(1).stroke();
//           doc.fontSize(8).fillColor("#fff").text("QR unavailable", 404, 186, { width: 72, align: "center" });
//         }
//       } catch {
//         doc.rect(400, 150, 80, 80).strokeColor("#ffffff").lineWidth(1).stroke();
//         doc.fontSize(8).fillColor("#fff").text("QR error", 404, 186, { width: 72, align: "center" });
//       }

//       doc.end();
//     } catch (err) { reject(err); }
//   });
// }

// module.exports = { generateTicket };

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

function tryRead(p) { try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch (_) {} return null; }

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const i = dataUrl.indexOf(",");
  if (i < 0) return null;
  return Buffer.from(dataUrl.slice(i + 1), "base64");
}

function normalizeSession(v) {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  const lower = s.toLowerCase();
  if (lower === "morning") return "Morning";
  if (lower === "evening") return "Evening";
  if (
    lower === "fullday" ||
    lower === "full day" ||
    lower === "full_day" ||
    lower === "full-day" ||
    lower === "full" ||
    lower === "fullday session" ||
    lower === "full day session" ||
    lower === "fulldayticket" ||
    lower === "fulldaypass" ||
    lower === "full pass" ||
    lower === "fulld"
  ) return "Full Day";
  if (lower.includes("morning")) return "Morning";
  if (lower.includes("evening")) return "Evening";
  if (lower.includes("full"))    return "Full Day";
  return s;
}

async function generateTicket(ticketData) {
  if (!ticketData || typeof ticketData !== "object") throw new Error("ticketData is required");

  const safe = {
    name:   String(ticketData.name   ?? "").trim() || "—",
    email:  String(ticketData.email  ?? "").trim() || "—",
    phone:  String(ticketData.phone  ?? "").trim() || "—",
    session:String(ticketData.session?? "").trim(),
    ticketId: String(ticketData.ticketId ?? "").trim() || "—",
    razorpayPaymentId: String(ticketData.razorpayPaymentId ?? "").trim() || "—",
    amount: Number.isFinite(Number(ticketData.amount)) ? Number(ticketData.amount) : "—",
  };

  const sessionLabel = normalizeSession(safe.session);
  const amountStr = safe.amount === "—" ? "—" : `₹ ${safe.amount}`;

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [500, 220], margin: 0 });
      const chunks = [];
      doc.on("data", c => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const assetsDir = path.join(__dirname, "assets");
      const xImg   = tryRead(path.join(assetsDir, "tedx-x-art.png"));
      const sunBg  = tryRead(path.join(assetsDir, "sun-bg.png"));
      const igIcon = tryRead(path.join(assetsDir, "ig.png"));
      const fontReg = tryRead(path.join(assetsDir, "Inter-Regular.ttf")) || tryRead(path.join(assetsDir, "Helvetica.ttf"));
      const fontBold= tryRead(path.join(assetsDir, "Inter-Bold.ttf")) || fontReg;
      if (fontReg)  doc.registerFont("REG",  fontReg);
      if (fontBold) doc.registerFont("BOLD", fontBold);

      // Left panel
      doc.save();
      doc.roundedRect(10, 10, 320, 200, 14).fill("#BE2326");
      if (sunBg) { doc.opacity(0.3).image(sunBg, 10, 10, { width: 320, height: 200 }); doc.opacity(1); }

      // Header
      doc.font(fontBold ? "BOLD" : "Helvetica-Bold").fontSize(26).fillColor("#fff").text("TED", 26, 28, { continued: true });
      doc.fillColor("#EB0028").text("x", { continued: true });
      doc.fillColor("#fff").text("DYPAkurdi");
      doc.font(fontReg ? "REG" : "Helvetica").fontSize(11).fillColor("#fff").text("x = Independently Organized TED Event", 26, 51);

      // Price
      doc.fontSize(22).fillColor("#fff").text(amountStr, 270, 28, { align: "right" });

      // Details block including Session (FIXED: use sessionLabel not safe.sessionLabel)
      const details = [
        { label: "Name",      value: safe.name },
        { label: "Email",     value: safe.email },
        { label: "Phone",     value: safe.phone },
        { label: "Session",   value: sessionLabel }, // FIXED: was safe.sessionLabel
        { label: "Ticket ID", value: safe.ticketId },
      ];
      let y = 85;
      for (const { label, value } of details) {
        doc
          .font(fontBold ? "BOLD" : "Helvetica-Bold")
          .fontSize(13)
          .fillColor("#fff")
          .text(`${label} : `, 26, y, { continued: true });
        doc.font(fontReg ? "REG" : "Helvetica").text(String(value));
        y += 22;
      }

      if (igIcon) { doc.image(igIcon, 26, 182, { width: 16, height: 16 }); doc.fontSize(10).fillColor("#fff").font(fontReg ? "REG" : "Helvetica").text("tedxdypakurdi", 48, 186); }
      doc.restore();

      // Right art
      if (xImg) doc.image(xImg, 340, 36, { width: 125, height: 145 });
      else doc.font(fontBold ? "BOLD" : "Helvetica-Bold").fontSize(140).fillColor("#EB0028").text("X", 355, 73);

      // QR payload with normalized Session (FIXED: use sessionLabel)
      const issuedAt = new Date().toISOString();
      const qrPayloadLines = [
        `Name:${safe.name}`,
        `Email:${safe.email}`,
        `Phone:${safe.phone}`,
        `Session:${sessionLabel}`, // FIXED: was safe.essionLabel
        `Amount:${amountStr}`,
        `TicketID:${safe.ticketId}`,
        `PaymentID:${safe.razorpayPaymentId}`,
        `IssuedAt:${issuedAt}`,
      ];
      const qrData = qrPayloadLines.join("\n");

      try {
        const dataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 80 });
        const qrBuffer = dataUrlToBuffer(dataUrl);
        if (qrBuffer) {
          doc.image(qrBuffer, 400, 150, { width: 80, height: 80 });
        } else {
          doc.rect(400, 150, 80, 80).strokeColor("#ffffff").lineWidth(1).stroke();
          doc.fontSize(8).fillColor("#fff").text("QR unavailable", 404, 186, { width: 72, align: "center" });
        }
      } catch {
        doc.rect(400, 150, 80, 80).strokeColor("#ffffff").lineWidth(1).stroke();
        doc.fontSize(8).fillColor("#fff").text("QR error", 404, 186, { width: 72, align: "center" });
      }

      doc.end();
    } catch (err) { reject(err); }
  });
} 

module.exports = { generateTicket };
