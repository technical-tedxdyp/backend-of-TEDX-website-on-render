
// // controllers/ticketController.js
// const Ticket = require("../../models/Ticket");
// const { connectDB } = require("../db");

// // Single connection bootstrap
// let dbInitPromise;
// async function ensureDB() {
//   dbInitPromise = dbInitPromise || connectDB();
//   return dbInitPromise;
// }

// // Normalize inbound session variants to stored canonical keys
// function normalizeSessionKey(input) {
//   if (!input || typeof input !== "string") return null;
//   const s = input.trim().toLowerCase();
//   if (s === "morning") return "morning";
//   if (s === "evening") return "evening";
//   if (s === "fullday" || s === "full day" || s === "full-day" || s === "full_day" || s === "full") return "fullDay";
//   return null; // reject unknowns to avoid mismatches
// }

// /**
//  * GET /api/tickets
//  * Query:
//  *  - page (default 1)
//  *  - limit (default 20, max 100)
//  *  - session: 'morning' | 'evening' | 'fullDay' (variants allowed via normalization)
//  *  - email: exact match (case-insensitive)
//  *  - q: fuzzy search on name/email/phone/ticketId
//  *  - sort: createdAt|-createdAt|amount|-amount (default -createdAt)
//  *  - includeRaw: 'true' to include internal ids and signatures
//  */
// exports.getAllTickets = async (req, res) => {
//   try {
//     await ensureDB();

//     // Pagination
//     const page = Math.max(1, parseInt(req.query.page, 10) || 1);
//     const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
//     const skip = (page - 1) * limit;

//     // Filters
//     const filter = {};

//     // Session filter (normalized)
//     const normalizedSession = normalizeSessionKey(req.query.session);
//     if (normalizedSession) filter.session = normalizedSession;

//     // Exact email (lowercased)
//     if (req.query.email && typeof req.query.email === "string") {
//       filter.email = req.query.email.trim().toLowerCase();
//     }

//     // Fuzzy q across key fields
//     if (req.query.q && typeof req.query.q === "string") {
//       const q = req.query.q.trim();
//       if (q.length > 0) {
//         filter.$or = [
//           { name: { $regex: q, $options: "i" } },
//           { email: { $regex: q, $options: "i" } },
//           { phone: { $regex: q, $options: "i" } },
//           { ticketId: { $regex: q, $options: "i" } },
//         ];
//       }
//     }

//     // Sorting
//     let sort = { createdAt: -1 };
//     if (req.query.sort) {
//       const allowed = new Set(["createdAt", "-createdAt", "amount", "-amount"]);
//       const s = String(req.query.sort);
//       if (allowed.has(s)) {
//         sort = s.startsWith("-") ? { [s.slice(1)]: -1 } : { [s]: 1 };
//       }
//     }

//     // Projection
//     const includeRaw = String(req.query.includeRaw || "").toLowerCase() === "true";
//     const projection = includeRaw ? {} : { razorpaySignature: 0, __v: 0 };

//     // Query + count in parallel
//     const [items, total] = await Promise.all([
//       Ticket.find(filter, projection).sort(sort).skip(skip).limit(limit).lean(),
//       Ticket.countDocuments(filter),
//     ]);

//     res.json({
//       page,
//       limit,
//       total,
//       totalPages: Math.max(1, Math.ceil(total / limit)),
//       items,
//     });
//   } catch (err) {
//     console.error("Error fetching tickets:", err?.message || err);
//     res.status(500).json({ error: "Failed to retrieve tickets" });
//   }
// };

// /**
//  * GET /api/tickets/:idOrCode
//  * Accepts Mongo _id (24-hex) or human ticketId (e.g., TEDX-00001)
//  */
// exports.getTicketById = async (req, res) => {
//   try {
//     await ensureDB();

//     const idOrCode = String(req.params.id || req.params.idOrCode || "").trim();
//     if (!idOrCode) {
//       return res.status(400).json({ error: "Ticket identifier is required" });
//     }

//     const isObjectId = /^[a-fA-F0-9]{24}$/.test(idOrCode);
//     const query = isObjectId ? { _id: idOrCode } : { ticketId: idOrCode };

//     const projection = { razorpaySignature: 0, __v: 0 };
//     const ticket = await Ticket.findOne(query, projection).lean();

//     if (!ticket) {
//       return res.status(404).json({ error: "Ticket not found" });
//     }

//     res.json(ticket);
//   } catch (err) {
//     console.error("Error fetching ticket:", err?.message || err);
//     res.status(500).json({ error: "Failed to retrieve ticket" });
//   }
// };

// /**
//  * (Optional) GET /api/tickets/export
//  * Exports a lightweight CSV for admins.
//  */
// exports.exportCSV = async (req, res) => {
//   try {
//     await ensureDB();

//     const rows = await Ticket.find(
//       {},
//       { _id: 0, ticketId: 1, name: 1, email: 1, phone: 1, session: 1, amount: 1, createdAt: 1 }
//     )
//       .sort({ createdAt: -1 })
//       .lean();

//     const headers = ["ticketId", "name", "email", "phone", "session", "amount", "createdAt"];
//     const csv = [
//       headers.join(","),
//       ...rows.map((r) =>
//         headers
//           .map((h) => {
//             const val = r[h] == null ? "" : String(r[h]).replace(/"/g, '""');
//             return /[",\n]/.test(val) ? `"${val}"` : val;
//           })
//           .join(",")
//       ),
//     ].join("\n");

//     res.setHeader("Content-Type", "text/csv; charset=utf-8");
//     res.setHeader("Content-Disposition", "attachment; filename=tickets.csv");
//     res.status(200).send(csv);
//   } catch (err) {
//     console.error("Error exporting tickets:", err?.message || err);
//     res.status(500).json({ error: "Failed to export tickets" });
//   }
// };

// controllers/ticketController.js
const Ticket = require("../../models/Ticket");
const { connectDB } = require("../db");

// Single connection bootstrap
let dbInitPromise;
async function ensureDB() {
  dbInitPromise = dbInitPromise || connectDB();
  return dbInitPromise;
}

// Canonical key normalizer for inbound filters
function normalizeSessionKey(input) {
  if (!input || typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (s === "morning") return "morning";
  if (s === "evening") return "evening";
  if (s === "fullday" || s === "full day" || s === "full-day" || s === "full_day" || s === "full") return "fullDay";
  return null; // reject unknowns to avoid mismatches
}

// Label normalizer for outbound convenience
function sessionKeyToLabel(key) {
  const v = String(key || "").toLowerCase();
  if (v === "morning") return "Morning";
  if (v === "evening") return "Evening";
  if (v === "fullday" || v === "fullDay".toLowerCase()) return "Full Day";
  // Passive fallback: return empty string so clients can choose to hide it
  return "";
}

/**
 * GET /api/tickets
 * Query:
 *  - page (default 1)
 *  - limit (default 20, max 100)
 *  - session: 'morning' | 'evening' | 'fullDay' (variants allowed via normalization)
 *  - email: exact match (case-insensitive)
 *  - q: fuzzy search on name/email/phone/ticketId
 *  - sort: createdAt|-createdAt|amount|-amount (default -createdAt)
 *  - includeRaw: 'true' to include internal ids and signatures
 */
exports.getAllTickets = async (req, res) => {
  try {
    await ensureDB();

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Filters
    const filter = {};

    // Session filter (normalized)
    const normalizedSession = normalizeSessionKey(req.query.session);
    if (normalizedSession) filter.session = normalizedSession;

    // Exact email (lowercased)
    if (req.query.email && typeof req.query.email === "string") {
      filter.email = req.query.email.trim().toLowerCase();
    }

    // Fuzzy q across key fields
    if (req.query.q && typeof req.query.q === "string") {
      const q = req.query.q.trim();
      if (q.length > 0) {
        filter.$or = [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
          { ticketId: { $regex: q, $options: "i" } },
        ];
      }
    }

    // Sorting
    let sort = { createdAt: -1 };
    if (req.query.sort) {
      const allowed = new Set(["createdAt", "-createdAt", "amount", "-amount"]);
      const s = String(req.query.sort);
      if (allowed.has(s)) {
        sort = s.startsWith("-") ? { [s.slice(1)]: -1 } : { [s]: 1 };
      }
    }

    // Projection
    const includeRaw = String(req.query.includeRaw || "").toLowerCase() === "true";
    const projection = includeRaw ? {} : { razorpaySignature: 0, __v: 0 };

    // Query + count in parallel
    const [itemsRaw, total] = await Promise.all([
      Ticket.find(filter, projection).sort(sort).skip(skip).limit(limit).lean(),
      Ticket.countDocuments(filter),
    ]);

    // Enrich with a derived label (non-breaking addition)
    const items = itemsRaw.map((t) => ({
      ...t,
      sessionLabel: sessionKeyToLabel(t.session),
    }));

    // Helpful caching headers for list responses
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items,
    });
  } catch (err) {
    console.error("Error fetching tickets:", err?.message || err);
    res.status(500).json({ error: "Failed to retrieve tickets" });
  }
};

/**
 * GET /api/tickets/:idOrCode
 * Accepts Mongo _id (24-hex) or human ticketId (e.g., TEDX-00001)
 * Returns stored session key plus a convenience sessionLabel for immediate display.
 */
exports.getTicketById = async (req, res) => {
  try {
    await ensureDB();

    const idOrCode = String(req.params.id || req.params.idOrCode || "").trim();
    if (!idOrCode) {
      return res.status(400).json({ error: "Ticket identifier is required" });
    }

    const isObjectId = /^[a-fA-F0-9]{24}$/.test(idOrCode);
    const query = isObjectId ? { _id: idOrCode } : { ticketId: idOrCode };

    const projection = { razorpaySignature: 0, __v: 0 };
    const ticket = await Ticket.findOne(query, projection).lean();

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Add a display label so clients don't have to guess
    const enriched = {
      ...ticket,
      sessionLabel: sessionKeyToLabel(ticket.session),
    };

    // Prevent stale caching of single-resource lookups during active sales
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json(enriched);
  } catch (err) {
    console.error("Error fetching ticket:", err?.message || err);
    res.status(500).json({ error: "Failed to retrieve ticket" });
  }
};

/**
 * (Optional) GET /api/tickets/export
 * Exports a lightweight CSV for admins.
 */
exports.exportCSV = async (req, res) => {
  try {
    await ensureDB();

    const rows = await Ticket.find(
      {},
      { _id: 0, ticketId: 1, name: 1, email: 1, phone: 1, session: 1, amount: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();

    const headers = ["ticketId", "name", "email", "phone", "session", "amount", "createdAt"];
    // If you prefer the human label in CSV, swap "session" above for a map with sessionLabel:
    // const headers = ["ticketId", "name", "email", "phone", "sessionLabel", "amount", "createdAt"];

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            // computed label on the fly if you changed the headers
            const value = h === "sessionLabel" ? sessionKeyToLabel(r.session) : r[h];
            const val = value == null ? "" : String(value).replace(/"/g, '""');
            return /[",\n]/.test(val) ? `"${val}"` : val;
          })
          .join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=tickets.csv");
    res.status(200).send(csv);
  } catch (err) {
    console.error("Error exporting tickets:", err?.message || err);
    res.status(500).json({ error: "Failed to export tickets" });
  }
};
