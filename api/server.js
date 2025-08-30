

// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const morgan = require("morgan");
// const { google } = require("googleapis");
// const { connectDB } = require("./utils/db");
// const paymentRoutes = require("./paymentRoutes");

// const PORT = process.env.PORT || 4000; // FIXED: Changed to 4000

// // Allowed origins
// const allowedOrigins = [
//   "https://tedx-dyp-akurdi.vercel.app",
//   "https://tedxdev.netlify.app",
//   "http://localhost:3000",
//   "http://localhost:1234",
//   "http://127.0.0.1:1234",
//   /^http:\/\/localhost:\d+$/, // allow any localhost port
//   /^https:\/\/.+-saurabhmelgirkars-projects\.vercel\.app$/, // preview URLs
//    'https://www.tedxdypakurdi.com',
//     'https://tedxdypakurdi.com' ,
// ];

// const app = express();
// const BODY_LIMIT = process.env.BODY_LIMIT || "10mb";

// // Middleware
// app.use(express.json({ limit: BODY_LIMIT }));
// app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));
// app.use(morgan("tiny"));

// // CORS
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin) return callback(null, true);
//       const ok = allowedOrigins.some((o) =>
//         typeof o === "string" ? o === origin : o.test(origin)
//       );
//       return ok
//         ? callback(null, true)
//         : callback(new Error(`Not allowed by CORS: ${origin}`));
//     },
//     credentials: true,
//     methods: ["GET", "POST", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     maxAge: 86400,
//   })
// );
// app.options("*", cors());

// // Routes
// app.get("/health", (req, res) => res.status(200).send("ok"));
// app.get("/", (req, res) => res.json({ message: "Server is running!" }));
// app.use("/api/payment", paymentRoutes);

// // FIXED: Add ticket routes for session recovery
// app.get("/api/tickets/:ticketId", async (req, res) => {
//   try {
//     const { ticketId } = req.params;
//     const Ticket = require("./models/Ticket");

//     const ticket = await Ticket.findOne({ ticketId }).lean();
//     if (!ticket) {
//       return res.status(404).json({ error: "Ticket not found" });
//     }

//     res.json(ticket);
//   } catch (err) {
//     console.error("Error fetching ticket:", err);
//     res.status(500).json({ error: "Failed to fetch ticket" });
//   }
// });

// app.use((req, res) => res.status(404).json({ error: "Not found" }));

// // Error handler
// app.use((err, req, res, next) => {
//   if (err?.type === "entity.too.large") {
//     return res.status(413).json({ error: "Payload too large" });
//   }
//   if (err instanceof SyntaxError && "body" in err) {
//     return res.status(400).json({ error: "Invalid JSON payload" });
//   }
//   console.error("Unhandled error:", err?.message || err);
//   res.status(500).json({ error: err?.message || "Internal Server Error" });
// });

// // ---- Google Sheets Auth ----
// async function verifyGoogleAuth() {
//   try {
//     const rawCreds = process.env.TEDX_GOOGLE_CREDENTIALS;
//     if (!rawCreds) {
//       throw new Error("Missing TEDX_GOOGLE_CREDENTIALS in env vars");
//     }

//     let creds;
//     try {
//       creds = JSON.parse(rawCreds);
//     } catch (err) {
//       throw new Error(
//         "Invalid JSON in TEDX_GOOGLE_CREDENTIALS (check escaping)"
//       );
//     }

//     if (!creds.private_key || !creds.client_email) {
//       throw new Error(
//         "Missing client_email or private_key in TEDX_GOOGLE_CREDENTIALS"
//       );
//     }

//     // Fix private key newlines
//     creds.private_key = creds.private_key.replace(/\\n/g, "\n");

//     const auth = new google.auth.JWT({
//       email: creds.client_email,
//       key: creds.private_key,
//       scopes: ["https://www.googleapis.com/auth/spreadsheets"],
//     });

//     await auth.authorize();
//     console.log("✅ Google Sheets auth OK");
//     return auth;
//   } catch (err) {
//     console.error("❌ Google auth failed:", err.message);
//     return null;
//   }
// }

// // ---- Start server ----
// (async () => {
//   try {
//     await connectDB();
//     await verifyGoogleAuth();
//     app.listen(PORT, () =>
//       console.log(`🚀 HTTP server listening on port ${PORT}`)
//     );
//   } catch (e) {
//     console.error("❌ Failed to start server:", e?.message || e);
//     process.exit(1);
//   }
// })();

// module.exports = app;

//  -------- old 3 -----------


// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const morgan = require("morgan");
// const { google } = require("googleapis");
// const { connectDB } = require("./utils/db");
// const paymentRoutes = require("./paymentRoutes");

// const PORT = process.env.PORT || 4000;
// const NODE_ENV = process.env.NODE_ENV || "development";

// // ENHANCED: More comprehensive allowed origins
// const allowedOrigins = [
//   "https://tedx-dyp-akurdi.vercel.app",
//   "https://tedxdev.netlify.app",
//   "http://localhost:3000",
//   "http://localhost:1234", 
//   "http://127.0.0.1:1234",
//   "http://localhost:5173", // Vite default
//   "http://localhost:3001", // Alternative React port
//   /^http:\/\/localhost:\d+$/, // allow any localhost port
//   /^https:\/\/.+-saurabhmelgirkars-projects\.vercel\.app$/, // preview URLs
//   'https://www.tedxdypakurdi.com',
//   'https://tedxdypakurdi.com',
//   // ADDED: Additional patterns for development
//   /^https:\/\/.*\.vercel\.app$/, // Any Vercel app
//   /^https:\/\/.*\.netlify\.app$/, // Any Netlify app
// ];

// const app = express();
// const BODY_LIMIT = process.env.BODY_LIMIT || "10mb";

// // ENHANCED: Startup validation
// console.log("🚀 Starting TEDx Payment Server...");
// console.log("📋 Environment:", {
//   NODE_ENV,
//   PORT,
//   BODY_LIMIT,
//   RAZORPAY_CONFIGURED: !!(process.env.TEDX_RAZORPAY_KEY_ID && process.env.TEDX_RAZORPAY_KEY_SECRET),
//   GOOGLE_CONFIGURED: !!process.env.TEDX_GOOGLE_CREDENTIALS,
//   MONGODB_CONFIGURED: !!process.env.MONGODB_URI,
// });

// // ENHANCED: Request logging middleware
// if (NODE_ENV === "development") {
//   app.use(morgan("dev"));
// } else {
//   app.use(morgan("combined"));
// }

// // Middleware
// app.use(express.json({ limit: BODY_LIMIT }));
// app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));

// // ENHANCED: CORS with better error handling
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       // Allow requests with no origin (mobile apps, curl, etc.)
//       if (!origin) return callback(null, true);
      
//       const ok = allowedOrigins.some((o) =>
//         typeof o === "string" ? o === origin : o.test(origin)
//       );
      
//       if (ok) {
//         callback(null, true);
//       } else {
//         console.warn(`🚫 CORS rejected origin: ${origin}`);
//         callback(new Error(`Not allowed by CORS: ${origin}`));
//       }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: [
//       "Content-Type", 
//       "Authorization", 
//       "X-Requested-With",
//       "Accept",
//       "Origin"
//     ],
//     maxAge: 86400,
//   })
// );

// // Handle preflight OPTIONS requests
// app.options("*", cors());

// // ADDED: Request tracking middleware
// app.use((req, res, next) => {
//   const start = Date.now();
//   res.on('finish', () => {
//     const duration = Date.now() - start;
//     if (duration > 5000) { // Log slow requests
//       console.warn(`⏱️ Slow request: ${req.method} ${req.path} took ${duration}ms`);
//     }
//   });
//   next();
// });

// // ENHANCED: Health check with detailed status
// app.get("/health", async (req, res) => {
//   try {
//     const health = {
//       status: "ok",
//       timestamp: new Date().toISOString(),
//       uptime: process.uptime(),
//       environment: NODE_ENV,
//       memory: process.memoryUsage(),
//       services: {
//         database: "unknown",
//         razorpay: "unknown",
//         google_sheets: "unknown"
//       }
//     };

//     // Quick database check
//     try {
//       const { mongoose } = require("mongoose");
//       health.services.database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
//     } catch (e) {
//       health.services.database = "error";
//     }

//     // Razorpay config check
//     health.services.razorpay = (process.env.TEDX_RAZORPAY_KEY_ID && process.env.TEDX_RAZORPAY_KEY_SECRET) 
//       ? "configured" 
//       : "not_configured";

//     // Google Sheets config check
//     health.services.google_sheets = process.env.TEDX_GOOGLE_CREDENTIALS 
//       ? "configured" 
//       : "not_configured";

//     res.status(200).json(health);
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       message: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// });

// // Root endpoint
// app.get("/", (req, res) => {
//   res.json({ 
//     message: "TEDx Payment Server is running!",
//     version: "2.0.0",
//     environment: NODE_ENV,
//     timestamp: new Date().toISOString()
//   });
// });

// // ENHANCED: API routes with error handling
// app.use("/api/payment", paymentRoutes);

// // ENHANCED: Ticket routes with better error handling
// app.get("/api/tickets/:ticketId", async (req, res) => {
//   try {
//     const { ticketId } = req.params;
    
//     // Basic validation
//     if (!ticketId || ticketId.length < 5) {
//       return res.status(400).json({ 
//         error: "Invalid ticket ID format" 
//       });
//     }

//     const Ticket = require("./models/Ticket");
//     const ticket = await Ticket.findOne({ ticketId }).lean();
    
//     if (!ticket) {
//       console.log(`❌ Ticket not found: ${ticketId}`);
//       return res.status(404).json({ 
//         error: "Ticket not found",
//         ticketId 
//       });
//     }

//     console.log(`✅ Ticket retrieved: ${ticketId}`);
    
//     // Return sanitized ticket data (don't expose internal fields)
//     const sanitizedTicket = {
//       ticketId: ticket.ticketId,
//       name: ticket.name,
//       email: ticket.email,
//       phone: ticket.phone,
//       session: ticket.session,
//       amount: ticket.amount,
//       department: ticket.department || "",
//       branch: ticket.branch || "",
//       razorpayPaymentId: ticket.razorpayPaymentId,
//       createdAt: ticket.createdAt
//     };

//     res.json(sanitizedTicket);
//   } catch (err) {
//     console.error("❌ Error fetching ticket:", err?.message || err);
//     res.status(500).json({ 
//       error: "Failed to fetch ticket",
//       message: err?.message || "Internal server error"
//     });
//   }
// });

// // ADDED: Environment info endpoint (for debugging in non-production)
// if (NODE_ENV !== "production") {
//   app.get("/debug/env", (req, res) => {
//     const safeEnv = {
//       NODE_ENV,
//       PORT,
//       TEDX_EVENT_ID: process.env.TEDX_EVENT_ID,
//       MONGODB_URI: process.env.MONGODB_URI ? "[CONFIGURED]" : "[MISSING]",
//       TEDX_RAZORPAY_KEY_ID: process.env.TEDX_RAZORPAY_KEY_ID ? `${process.env.TEDX_RAZORPAY_KEY_ID.slice(0, 8)}...` : "[MISSING]",
//       TEDX_RAZORPAY_KEY_SECRET: process.env.TEDX_RAZORPAY_KEY_SECRET ? "[CONFIGURED]" : "[MISSING]",
//       TEDX_GOOGLE_CREDENTIALS: process.env.TEDX_GOOGLE_CREDENTIALS ? "[CONFIGURED]" : "[MISSING]",
//       BODY_LIMIT
//     };
//     res.json(safeEnv);
//   });
// }

// // 404 handler
// app.use((req, res) => {
//   console.warn(`❌ 404 - Route not found: ${req.method} ${req.path}`);
//   res.status(404).json({ 
//     error: "Route not found",
//     method: req.method,
//     path: req.path,
//     timestamp: new Date().toISOString()
//   });
// });

// // ENHANCED: Global error handler with better logging
// app.use((err, req, res, next) => {
//   const timestamp = new Date().toISOString();
//   const errorId = Math.random().toString(36).substring(2, 15);
  
//   // Log error details
//   console.error(`❌ Error [${errorId}] at ${timestamp}:`, {
//     message: err?.message,
//     stack: err?.stack,
//     method: req?.method,
//     path: req?.path,
//     origin: req?.headers?.origin,
//     userAgent: req?.headers?.['user-agent']
//   });

//   // Handle specific error types
//   if (err?.type === "entity.too.large") {
//     return res.status(413).json({ 
//       error: "Payload too large",
//       maxSize: BODY_LIMIT,
//       errorId
//     });
//   }
  
//   if (err instanceof SyntaxError && "body" in err) {
//     return res.status(400).json({ 
//       error: "Invalid JSON payload",
//       message: "Request body contains invalid JSON",
//       errorId
//     });
//   }

//   // CORS errors
//   if (err?.message?.includes("Not allowed by CORS")) {
//     return res.status(403).json({
//       error: "CORS policy violation",
//       message: "Origin not allowed",
//       errorId
//     });
//   }

//   // Generic error response
//   const isDevelopment = NODE_ENV === "development";
//   res.status(500).json({
//     error: "Internal Server Error",
//     message: isDevelopment ? err?.message : "Something went wrong",
//     errorId,
//     timestamp,
//     ...(isDevelopment && { stack: err?.stack })
//   });
// });

// // ENHANCED: Google Sheets Auth with better error handling
// async function verifyGoogleAuth() {
//   try {
//     console.log("🔐 Verifying Google Sheets authentication...");
    
//     const rawCreds = process.env.TEDX_GOOGLE_CREDENTIALS;
//     if (!rawCreds) {
//       throw new Error("Missing TEDX_GOOGLE_CREDENTIALS in environment variables");
//     }

//     let creds;
//     try {
//       creds = JSON.parse(rawCreds);
//     } catch (err) {
//       throw new Error("Invalid JSON in TEDX_GOOGLE_CREDENTIALS (check escaping)");
//     }

//     if (!creds.private_key || !creds.client_email) {
//       throw new Error("Missing client_email or private_key in TEDX_GOOGLE_CREDENTIALS");
//     }

//     // Fix private key newlines
//     creds.private_key = creds.private_key.replace(/\\n/g, "\n");

//     const auth = new google.auth.JWT({
//       email: creds.client_email,
//       key: creds.private_key,
//       scopes: ["https://www.googleapis.com/auth/spreadsheets"],
//     });

//     await auth.authorize();
//     console.log("✅ Google Sheets authentication successful");
//     return auth;
    
//   } catch (err) {
//     console.error("❌ Google Sheets authentication failed:", err.message);
//     if (NODE_ENV === "production") {
//       console.warn("⚠️ Google Sheets will be unavailable - logging may fail");
//     }
//     return null;
//   }
// }

// // ENHANCED: Razorpay configuration check
// async function verifyRazorpayConfig() {
//   try {
//     console.log("🔐 Verifying Razorpay configuration...");
    
//     const keyId = process.env.TEDX_RAZORPAY_KEY_ID;
//     const keySecret = process.env.TEDX_RAZORPAY_KEY_SECRET;

//     if (!keyId || !keySecret) {
//       throw new Error("Missing Razorpay API keys in environment variables");
//     }

//     const keyType = keyId.startsWith('rzp_test_') ? 'TEST' : keyId.startsWith('rzp_live_') ? 'LIVE' : 'UNKNOWN';
    
//     if (keyType === 'UNKNOWN') {
//       throw new Error("Invalid Razorpay key format - must start with 'rzp_test_' or 'rzp_live_'");
//     }

//     console.log(`✅ Razorpay ${keyType} keys configured`);
    
//     // Test connection if we have the utils available
//     try {
//       const { testConnection } = require("./utils/razorpayUtils");
//       await testConnection();
//       console.log("✅ Razorpay connection test passed");
//     } catch (testErr) {
//       console.warn("⚠️ Razorpay connection test failed:", testErr.message);
//       if (NODE_ENV === "production") {
//         throw testErr; // Fail startup in production if Razorpay is not working
//       }
//     }

//     return { keyType, configured: true };
    
//   } catch (err) {
//     console.error("❌ Razorpay configuration failed:", err.message);
//     if (NODE_ENV === "production") {
//       throw err; // Fail startup in production
//     }
//     return { configured: false, error: err.message };
//   }
// }

// // ENHANCED: Graceful shutdown handling
// process.on('SIGINT', async () => {
//   console.log('📴 Received SIGINT, shutting down gracefully...');
  
//   try {
//     const { mongoose } = require("mongoose");
//     await mongoose.connection.close();
//     console.log('✅ MongoDB connection closed');
//   } catch (err) {
//     console.error('❌ Error closing MongoDB:', err.message);
//   }
  
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   console.log('📴 Received SIGTERM, shutting down gracefully...');
//   process.exit(0);
// });

// // ENHANCED: Server startup with comprehensive checks
// (async () => {
//   try {
//     console.log("🚀 Initializing TEDx Payment Server...");

//     // 1. Connect to database
//     console.log("📦 Connecting to MongoDB...");
//     await connectDB();

//     // 2. Verify Razorpay configuration
//     const razorpayStatus = await verifyRazorpayConfig();
//     if (!razorpayStatus.configured && NODE_ENV === "production") {
//       throw new Error("Razorpay configuration failed in production environment");
//     }

//     // 3. Verify Google Sheets (non-blocking)
//     await verifyGoogleAuth();

//     // 4. Start server
//     const server = app.listen(PORT, () => {
//       console.log(`🎉 TEDx Payment Server started successfully!`);
//       console.log(`🌐 Server: http://localhost:${PORT}`);
//       console.log(`📊 Health: http://localhost:${PORT}/health`);
//       console.log(`🔧 Environment: ${NODE_ENV}`);
      
//       if (NODE_ENV !== "production") {
//         console.log(`🐛 Debug info: http://localhost:${PORT}/debug/env`);
//       }
//     });

//     // Handle server startup errors
//     server.on('error', (err) => {
//       if (err.code === 'EADDRINUSE') {
//         console.error(`❌ Port ${PORT} is already in use`);
//       } else {
//         console.error("❌ Server startup error:", err.message);
//       }
//       process.exit(1);
//     });

//   } catch (e) {
//     console.error("❌ Failed to start server:", e?.message || e);
//     console.error("💡 Check your environment variables and database connection");
//     process.exit(1);
//   }
// })();

// module.exports = app;

import React, { useEffect, useState, useRef } from "react";

// Map UI labels to backend keys
const SESSION_KEY = {
  "Morning Session": "morning",
  "Full Day Session": "fullDay", 
  "Evening Session": "evening",
};

// Sessions with bullet point speaker lists
const SESSIONS = [
  {
    id: 1,
    name: "Morning Session",
    description: (
      <ul className="list-disc list-inside space-y-2 text-gray-300 text-left px-2">
        <li>Mrs. Bela Shende</li>
        <li>Dr. Popatrao Pawar</li>
      </ul>
    ),
    price: 49,
    save: null,
  },
  {
    id: 2,
    name: "Full Day Session",
    description: (
      <ul className="list-disc list-inside space-y-2 text-gray-300 text-left px-2">
        <li>Mrs. Bela Shende</li>
        <li>Dr. Popatrao Pawar</li>
        <li>Mr. Rajan Chopra</li>
        <li>Mr. Nitin Pandey</li>
        <li>Mrs. Aishwarya Pissay</li>
      </ul>
    ),
    price: 69,
    save: "",
    popular: true,
  },
  {
    id: 3,
    name: "Evening Session",
    description: (
      <ul className="list-disc list-inside space-y-2 text-gray-300 text-left px-2">
        <li>Mr. Rajan Chopra</li>
        <li>Mr. Nitin Pandey</li>
        <li>Mrs. Aishwarya Pissay</li>
      </ul>
    ),
    price: 49,
    save: "",
  },
];

// FIXED: Use your live Razorpay key directly
const RAZORPAY_KEY_ID = "rzp_live_RAdCru2UL8q5u1";

const InfoBox = ({ title, value }) => (
  <div className="header-box flex flex-col w-full min-w-[240px] max-w-[340px] border-2 border-[#EB0028] overflow-hidden mx-3 mb-3 rounded-2xl shadow-lg">
    <div className="p-6 font-bold text-2xl bg-[#EB0028] text-white">{title}</div>
    <div className="header-box-value text-lg py-8">{value}</div>
  </div>
);

const SessionCard = ({ session, onSelect, isSelected, isSoldOut }) => (
  <div
    className={`ticket-card ${session.popular ? "popular" : ""} ${
      isSelected ? "selected" : ""
    } ${isSoldOut ? "sold-out opacity-60" : "cursor-pointer"} relative bg-[#17171a]/90 border border-white/10 hover:border-white/20 hover:-translate-y-1 transition-all duration-200 shadow-xl`}
    onClick={isSoldOut ? undefined : () => onSelect(session)}
    style={{ 
      minWidth: "320px", 
      maxWidth: "400px", 
      padding: "2.2rem", 
      marginBottom: "1rem", 
      borderRadius: "1.5rem",
      cursor: isSoldOut ? "not-allowed" : "pointer"
    }}
  >
    {session.popular && (
      <span className="absolute -top-4 left-1/2 -translate-x-1/2 save-tag uppercase font-bold text-xs tracking-wide bg-[#EB0028] text-white px-4 py-1 rounded-full shadow-lg">
        Most Popular
      </span>
    )}
    
    {isSoldOut && (
      <span className="absolute -top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
        SOLD OUT
      </span>
    )}
    
    <div className="flex justify-end mb-3">
      {typeof session.save === "string" && session.save.trim().length > 0 && <span className="save-tag">{session.save}</span>}
    </div>
    
    <h3 className="text-2xl font-bold mb-4 text-white text-center">{session.name}</h3>
    <div className="text-base mb-6">{session.description}</div>
    
    <div className="flex justify-between items-end">
      <span className="text-4xl font-extrabold">₹{session.price}</span>
      <button
        className={`mt-2 text-base py-3 px-6 rounded-xl font-bold transition-all shadow-lg ${
          isSoldOut 
            ? 'bg-gray-500 cursor-not-allowed text-gray-300' 
            : 'bg-gradient-to-r from-[#EB0028] to-[#c20021] text-white hover:shadow-2xl hover:scale-[1.02]'
        }`}
        type="button"
        disabled={isSoldOut}
        onClick={(e) => {
          e.stopPropagation();
          if (!isSoldOut) onSelect(session);
        }}
      >
        {isSoldOut ? "Sold Out" : "Buy Now"}
      </button>
    </div>
  </div>
);

const ConfirmModal = ({ isOpen, onClose, formData, selectedSession, onPay, isSoldOut }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="modal-card relative p-10 w-full max-w-xl mx-2 rounded-2xl bg-[#1b1b1f] text-white shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-white bg-[#EB0028] rounded-full p-2 hover:bg-[#c20021] transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-2xl font-extrabold mb-4 text-[#EB0028] text-center">Confirm Your Details & Ticket</h2>
        <p className="text-base text-gray-300 mb-7 text-center">Please verify your details before payment.</p>
        
        {isSoldOut && (
          <div className="bg-red-900 border border-red-500 text-red-100 px-4 py-3 rounded mb-6 text-center">
            <strong>⚠️ This session is now sold out!</strong>
            <p className="text-sm mt-1">Please select a different session to proceed.</p>
          </div>
        )}
        
        <div className="flex flex-col gap-3 text-lg mb-9">
          <div><span className="font-bold text-[#EB0028]">Name:</span> <span className="ml-2">{formData.name}</span></div>
          <div><span className="font-bold text-[#EB0028]">Email:</span> <span className="ml-2">{formData.email}</span></div>
          <div><span className="font-bold text-[#EB0028]">Contact No.:</span> <span className="ml-2">{formData.phone}</span></div>
          <div><span className="font-bold text-[#EB0028]">Department:</span> <span className="ml-2">{formData.department}</span></div>
          <div><span className="font-bold text-[#EB0028]">Branch:</span> <span className="ml-2">{formData.branch}</span></div>
          <div><span className="font-bold text-[#EB0028]">Session:</span> <span className="ml-2">{selectedSession?.name}</span></div>
          <div><span className="font-bold text-[#EB0028]">Amount:</span> <span className="ml-2">₹{selectedSession?.price}</span></div>
        </div>
        
        <button 
          onClick={onPay} 
          disabled={isSoldOut}
          className={`w-full py-4 text-lg font-bold rounded-xl transition-colors mt-2 shadow-lg ${
            isSoldOut 
              ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
              : 'bg-[#EB0028] text-white hover:bg-[#c20021]'
          }`}
        >
          {isSoldOut ? "Session Sold Out" : "Pay Now"}
        </button>
      </div>
    </div>
  );
};

const ErrorNotification = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-lg animate-bounce">
      <div className="bg-gradient-to-r from-[#EB0028] to-[#c20021] text-white font-bold text-lg px-6 py-4 rounded-2xl shadow-2xl flex justify-between items-center">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition">✕</button>
      </div>
    </div>
  );
};

// Backend base URL
const API_BASE_URL = "https://backendoftedxdypakurdi.onrender.com";

const TicketPage = () => {
  const [selectedSession, setSelectedSession] = useState(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    phone: "", 
    department: "", 
    branch: "" 
  });
  const [showModal, setShowModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [availability, setAvailability] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const detailsRef = useRef(null);

  // ✅ FIXED: Only check if Razorpay SDK is available (no dynamic loading)
  useEffect(() => {
    if (!window.Razorpay) {
      console.error("❌ Razorpay SDK not loaded");
      setErrorMessage("Payment system not loaded. Please refresh the page.");
    } else {
      console.log("✅ Razorpay SDK is available");
    }
  }, []);

  // Fetch availability
  useEffect(() => {
    fetchAvailability();
    const interval = setInterval(fetchAvailability, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAvailability = async () => {
    try {
      console.log("🔄 Fetching availability...");
      const res = await fetch(`${API_BASE_URL}/api/payment/availability`);
      if (!res.ok) throw new Error("Failed to fetch availability");
      
      const data = await res.json();
      console.log("📊 Availability data:", data);
      
      setAvailability(data);
      setLoadingAvailability(false);
    } catch (error) {
      console.error("❌ Error fetching availability:", error);
      setLoadingAvailability(false);
      setAvailability({
        morningAvailable: 0,
        eveningAvailable: 0,
        fullDayAvailable: 0
      });
    }
  };

  const isSessionSoldOut = (sessionName) => {
    if (!availability) return false;
    
    const sessionKey = SESSION_KEY[sessionName];
    switch (sessionKey) {
      case "morning":
        return availability.morningAvailable <= 0;
      case "evening":
        return availability.eveningAvailable <= 0;
      case "fullDay":
        return availability.fullDayAvailable <= 0;
      default:
        return false;
    }
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSession) {
      setErrorMessage("⚠️ Please select a session (Morning / Full Day / Evening) before proceeding.");
      return;
    }
    
    if (isSessionSoldOut(selectedSession.name)) {
      setErrorMessage("🚫 This session is sold out! Please select a different session.");
      return;
    }
    
    setShowModal(true);
  };

  // Clear error automatically
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const precheckAvailability = async () => {
    try {
      await fetchAvailability();
      
      if (!selectedSession || !availability) return { ok: false, snapshot: null };
      
      const sessionKey = SESSION_KEY[selectedSession.name];
      let available = 0;
      
      switch (sessionKey) {
        case "morning":
          available = availability.morningAvailable;
          break;
        case "evening":
          available = availability.eveningAvailable;
          break;
        case "fullDay":
          available = availability.fullDayAvailable;
          break;
      }
      
      return { ok: available > 0, snapshot: availability };
    } catch (error) {
      console.error("Availability check error:", error);
      return { ok: false, snapshot: null };
    }
  };

  // ✅ ULTRA-MINIMAL Razorpay options to prevent 400 error
  const initiatePayment = async () => {
    try {
      if (!selectedSession) return;
      
      if (isSessionSoldOut(selectedSession.name)) {
        setErrorMessage(`🚫 The ${selectedSession.name} is now sold out! Please select a different session.`);
        setShowModal(false);
        return;
      }

      console.log("🎫 Starting payment process for:", selectedSession.name);

      const check = await precheckAvailability();
      if (!check.ok) {
        setErrorMessage("❌ Sorry, this session is sold out!");
        setShowModal(false);
        return;
      }

      // Create backend order
      const backendSessionKey = SESSION_KEY[selectedSession.name];
      console.log("🔄 Creating order with session:", backendSessionKey);
      
      const orderRes = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amount: selectedSession.price,
          session: backendSessionKey,
          email: formData.email,
          name: formData.name
        }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json().catch(() => ({}));
        console.error("❌ Order creation failed:", errorData);
        
        if (orderRes.status === 409 || errorData.error === "Seats are full") {
          setErrorMessage(`🚫 Sorry! All seats for the ${selectedSession.name} are now sold out.`);
          fetchAvailability();
        } else if (orderRes.status === 401) {
          setErrorMessage("❌ Payment gateway authentication failed. Please try again later.");
        } else {
          setErrorMessage(errorData.message || "Failed to create payment order.");
        }
        setShowModal(false);
        return;
      }

      const orderData = await orderRes.json();
      console.log("✅ Order created:", orderData);

      // Validate order response
      if (!orderData.id) {
        console.error("❌ Invalid order response - missing order ID:", orderData);
        setErrorMessage("Failed to create payment order. Please try again.");
        setShowModal(false);
        return;
      }

      if (!window.Razorpay) {
        setErrorMessage("❌ Payment system not loaded. Please refresh and try again.");
        return;
      }

      // ✅ ABSOLUTE MINIMAL Razorpay options to prevent session_token error
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: "INR",
        name: "TEDx DYP Akurdi",
        order_id: orderData.id,
        handler: function(response) {
          console.log("✅ Payment successful:", response);
          verifyPayment(response);
        }
        // ❌ REMOVED: prefill, theme, description, modal, error - all extra parameters
      };

      console.log("🚀 Minimal Razorpay options:", {
        key: options.key.substring(0, 12) + "...",
        amount: options.amount,
        currency: options.currency,
        order_id: options.order_id
      });

      // Initialize Razorpay with absolute minimal options
      const rzp = new window.Razorpay(options);
      rzp.open();
      setShowModal(false);

    } catch (err) {
      console.error("❌ Payment initiation error:", err);
      setErrorMessage("Error initiating payment. Please try again.");
      setShowModal(false);
    }
  };

  // Payment verification
  const verifyPayment = async (response) => {
    try {
      console.log("💳 Verifying payment...", response);
      const backendSessionKey = SESSION_KEY[selectedSession.name];
      
      const res = await fetch(`${API_BASE_URL}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          branch: formData.branch,
          session: backendSessionKey,
          amount: selectedSession.price,
        }),
      });

      const data = await res.json();
      console.log("🔍 Verification response:", data);

      if (data.success) {
        console.log("✅ Payment verified successfully:", data.ticketId);
        
        // Build success URL with all required parameters
        const successParams = new URLSearchParams({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          amount: selectedSession.price,
          ticketId: data.ticketId,
          razorpayPaymentId: response.razorpay_payment_id,
          session: selectedSession.name
        });
        
        window.location.href = `/success?${successParams.toString()}`;
      } else {
        console.error("❌ Payment verification failed:", data);
        setErrorMessage(data.message || "Payment verification failed. Please contact support.");
      }
    } catch (e) {
      console.error("❌ Payment verification error:", e);
      setErrorMessage("Error verifying payment. Please contact support if amount was debited.");
    }
  };

  const handleSessionSelect = (session) => {
    setSelectedSession(session);
    requestAnimationFrame(() => {
      if (detailsRef.current) {
        const top = detailsRef.current.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({
          top,
          behavior: "smooth",
        });
      }
    });
  };

  const selectedSessionSoldOut = selectedSession ? isSessionSoldOut(selectedSession.name) : false;

  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-x-hidden">
      
      <ErrorNotification message={errorMessage} onClose={() => setErrorMessage("")} />
      
      <div className="relative z-10 py-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="section-title">Register for the TEDxDYPAkurdi Event!</h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              The flagship event of TEDxDYPAkurdi, a platform for experts and enthusiasts to voice their "Ideas worth spreading."
            </p>
          </div>

          {/* Event info */}
          <div className="flex flex-col md:flex-row justify-center items-center gap-10 mb-16">
            <InfoBox title="Date" value="12th September 2025" />
            <InfoBox title="Venue" value="Shantai Auditorium DYP Akurdi Campus" />
            <InfoBox title="Time" value="09 am Onwards" />
          </div>

          {/* Pricing */}
          <div className="text-center mb-12">
            <h2 className="section-title text-xl mb-8 text-gray-200">Pricing for the Tickets</h2>
            {loadingAvailability && (
              <div className="mb-6 text-gray-400">
                <p>🔄 Checking availability...</p>
              </div>
            )}
            <div className="flex flex-col md:flex-row justify-center items-stretch gap-8">
              {SESSIONS.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onSelect={handleSessionSelect}
                  isSelected={selectedSession?.id === session.id}
                  isSoldOut={isSessionSoldOut(session.name)}
                />
              ))}
            </div>
          </div>

          {/* Form */}
          <div ref={detailsRef} className="form-card max-w-4xl mx-auto px-8 md:px-16 py-12 rounded-3xl shadow-2xl mt-10 bg-[#17171a] border border-white/10">
            <h2 className="mb-10 text-3xl font-extrabold text-[#EB0028] tracking-wide flex items-end gap-3">
              Details <span className="block text-lg text-gray-300 font-normal pb-1">for next steps</span>
            </h2>
            <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="name" className="block mb-3 text-xl font-bold text-white">Your Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className="w-full h-16 px-5 rounded-xl border-2 border-[#333] bg-[#0f0f12] text-white text-lg placeholder-gray-400 focus:ring-2 focus:ring-[#EB0028] focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="email" className="block mb-3 text-xl font-bold text-white">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  className="w-full h-16 px-5 rounded-xl border-2 border-[#333] bg-[#0f0f12] text-white text-lg placeholder-gray-400 focus:ring-2 focus:ring-[#EB0028] focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block mb-3 text-xl font-bold text-white">Contact No.</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter your contact number"
                  className="w-full h-16 px-5 rounded-xl border-2 border-[#333] bg-[#0f0f12] text-white text-lg placeholder-gray-400 focus:ring-2 focus:ring-[#EB0028] focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="department" className="block mb-3 text-xl font-bold text-white">Department of Study <span className="text-base font-normal text-gray-300">(optional)</span></label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  placeholder="Enter your department"
                  className="w-full h-16 px-5 rounded-xl border-2 border-[#333] bg-[#0f0f12] text-white text-lg placeholder-gray-400 focus:ring-2 focus:ring-[#EB0028] focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="branch" className="block mb-3 text-xl font-bold text-white">Branch <span className="text-base font-normal text-gray-300">(optional)</span></label>
                <input
                  type="text"
                  id="branch"
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  placeholder="Enter your branch"
                  className="w-full h-16 px-5 rounded-xl border-2 border-[#333] bg-[#0f0f12] text-white text-lg placeholder-gray-400 focus:ring-2 focus:ring-[#EB0028] focus:border-transparent transition"
                />
              </div>
              <div className="flex justify-center pt-6">
                <button
                  type="submit"
                  disabled={!selectedSession || selectedSessionSoldOut}
                  className={`px-16 py-4 text-2xl rounded-xl font-extrabold shadow-lg transition-all ${
                    !selectedSession || selectedSessionSoldOut
                      ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#EB0028] to-[#c20021] hover:from-[#ff304a] hover:to-[#e0002a] text-white'
                  }`}
                >
                  {selectedSessionSoldOut ? "Session Sold Out" : "Proceed to pay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        formData={formData}
        selectedSession={selectedSession}
        onPay={initiatePayment}
        isSoldOut={selectedSessionSoldOut}
      />
    </div>
  );
};

export default TicketPage;

