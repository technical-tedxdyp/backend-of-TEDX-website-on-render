// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const morgan = require('morgan');
// const { google } = require('googleapis');
// const { connectDB } = require('./utils/db');
// const paymentRoutes = require('./paymentRoutes');

// const PORT = process.env.PORT || 3000;

// // Allowed origins
// const allowedOrigins = [
//   'https://tedx-dyp-akurdi.vercel.app',
//   'https://tedxdev.netlify.app',
//   'http://localhost:3000',
//   'http://localhost:1234',
//   'http://127.0.0.1:1234',
//   /^http:\/\/localhost:\d+$/, // allow any localhost port
//   /^https:\/\/.+-saurabhmelgirkars-projects\.vercel\.app$/, // preview URLs
// ];

// const app = express();
// const BODY_LIMIT = process.env.BODY_LIMIT || '10mb';

// // Middleware
// app.use(express.json({ limit: BODY_LIMIT }));
// app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));
// app.use(morgan('tiny'));

// // CORS
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin) return callback(null, true);
//       const ok = allowedOrigins.some((o) =>
//         typeof o === 'string' ? o === origin : o.test(origin)
//       );
//       return ok
//         ? callback(null, true)
//         : callback(new Error(`Not allowed by CORS: ${origin}`));
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     maxAge: 86400,
//   })
// );
// app.options('*', cors());

// // Routes
// app.get('/health', (req, res) => res.status(200).send('ok'));
// app.get('/', (req, res) => res.json({ message: 'Server is running!' }));
// app.use('/api/payment', paymentRoutes);
// app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// // Error handler
// app.use((err, req, res, next) => {
//   if (err?.type === 'entity.too.large') {
//     return res.status(413).json({ error: 'Payload too large' });
//   }
//   if (err instanceof SyntaxError && 'body' in err) {
//     return res.status(400).json({ error: 'Invalid JSON payload' });
//   }
//   console.error('Unhandled error:', err?.message || err);
//   res.status(500).json({ error: err?.message || 'Internal Server Error' });
// });

// // ---- Google Sheets Auth ----
// async function verifyGoogleAuth() {
//   try {
//     const rawCreds = process.env.TEDX_GOOGLE_CREDENTIALS;
//     if (!rawCreds) {
//       throw new Error('Missing TEDX_GOOGLE_CREDENTIALS in env vars');
//     }

//     let creds;
//     try {
//       creds = JSON.parse(rawCreds);
//     } catch (err) {
//       throw new Error('Invalid JSON in TEDX_GOOGLE_CREDENTIALS (check escaping)');
//     }

//     if (!creds.private_key || !creds.client_email) {
//       throw new Error('Missing client_email or private_key in TEDX_GOOGLE_CREDENTIALS');
//     }

//     // Fix private key newlines
//     creds.private_key = creds.private_key.replace(/\\n/g, '\n');

//     const auth = new google.auth.JWT({
//       email: creds.client_email,
//       key: creds.private_key,
//       scopes: ['https://www.googleapis.com/auth/spreadsheets'],
//     });

//     await auth.authorize();
//     console.log('✅ Google Sheets auth OK');
//     return auth;
//   } catch (err) {
//     console.error('❌ Google auth failed:', err.message);
//     return null;
//   }
// }

// // ---- Start server ----
// (async () => {
//   try {
//     await connectDB();
//     await verifyGoogleAuth();
//     app.listen(PORT, () => console.log(`🚀 HTTP server listening on port ${PORT}`));
//   } catch (e) {
//     console.error('❌ Failed to start server:', e?.message || e);
//     process.exit(1);
//   }
// })();

// module.exports = app;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { google } = require("googleapis");
const { connectDB } = require("./utils/db");
const paymentRoutes = require("./paymentRoutes");

const PORT = process.env.PORT || 4000; // FIXED: Changed to 4000

// Allowed origins
const allowedOrigins = [
  "https://tedx-dyp-akurdi.vercel.app",
  "https://tedxdev.netlify.app",
  "http://localhost:3000",
  "http://localhost:1234",
  "http://127.0.0.1:1234",
  /^http:\/\/localhost:\d+$/, // allow any localhost port
  /^https:\/\/.+-saurabhmelgirkars-projects\.vercel\.app$/, // preview URLs
];

const app = express();
const BODY_LIMIT = process.env.BODY_LIMIT || "10mb";

// Middleware
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));
app.use(morgan("tiny"));

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const ok = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin)
      );
      return ok
        ? callback(null, true)
        : callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);
app.options("*", cors());

// Routes
app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/", (req, res) => res.json({ message: "Server is running!" }));
app.use("/api/payment", paymentRoutes);

// FIXED: Add ticket routes for session recovery
app.get("/api/tickets/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const Ticket = require("./models/Ticket");

    const ticket = await Ticket.findOne({ ticketId }).lean();
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(ticket);
  } catch (err) {
    console.error("Error fetching ticket:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Error handler
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  console.error("Unhandled error:", err?.message || err);
  res.status(500).json({ error: err?.message || "Internal Server Error" });
});

// ---- Google Sheets Auth ----
async function verifyGoogleAuth() {
  try {
    const rawCreds = process.env.TEDX_GOOGLE_CREDENTIALS;
    if (!rawCreds) {
      throw new Error("Missing TEDX_GOOGLE_CREDENTIALS in env vars");
    }

    let creds;
    try {
      creds = JSON.parse(rawCreds);
    } catch (err) {
      throw new Error(
        "Invalid JSON in TEDX_GOOGLE_CREDENTIALS (check escaping)"
      );
    }

    if (!creds.private_key || !creds.client_email) {
      throw new Error(
        "Missing client_email or private_key in TEDX_GOOGLE_CREDENTIALS"
      );
    }

    // Fix private key newlines
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");

    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    await auth.authorize();
    console.log("✅ Google Sheets auth OK");
    return auth;
  } catch (err) {
    console.error("❌ Google auth failed:", err.message);
    return null;
  }
}

// ---- Start server ----
(async () => {
  try {
    await connectDB();
    await verifyGoogleAuth();
    app.listen(PORT, () =>
      console.log(`🚀 HTTP server listening on port ${PORT}`)
    );
  } catch (e) {
    console.error("❌ Failed to start server:", e?.message || e);
    process.exit(1);
  }
})();

module.exports = app;
