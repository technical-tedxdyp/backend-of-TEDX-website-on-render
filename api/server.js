// // require('dotenv').config();
// // const express = require('express');
// // const cors = require('cors');
// // const morgan = require('morgan');
// // const { google } = require('googleapis');
// // const { connectDB } = require('./utils/db');
// // const paymentRoutes = require('./paymentRoutes');

// // const PORT = process.env.PORT || 3000;

// // // Allowed origins
// // const allowedOrigins = [
// //   'https://tedx-dyp-akurdi.vercel.app',
// //   'https://tedxdev.netlify.app',
// //   'http://localhost:3000',
// //   'http://localhost:1234',
// //   'http://127.0.0.1:1234',
// //   /^http:\/\/localhost:\d+$/, // allow any localhost port
// //   /^https:\/\/.+-saurabhmelgirkars-projects\.vercel\.app$/, // preview URLs
// // ];

// // const app = express();
// // const BODY_LIMIT = process.env.BODY_LIMIT || '10mb';

// // // Middleware
// // app.use(express.json({ limit: BODY_LIMIT }));
// // app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));
// // app.use(morgan('tiny'));

// // // CORS
// // app.use(
// //   cors({
// //     origin: (origin, callback) => {
// //       if (!origin) return callback(null, true);
// //       const ok = allowedOrigins.some((o) =>
// //         typeof o === 'string' ? o === origin : o.test(origin)
// //       );
// //       return ok
// //         ? callback(null, true)
// //         : callback(new Error(`Not allowed by CORS: ${origin}`));
// //     },
// //     credentials: true,
// //     methods: ['GET', 'POST', 'OPTIONS'],
// //     allowedHeaders: ['Content-Type', 'Authorization'],
// //     maxAge: 86400,
// //   })
// // );
// // app.options('*', cors());

// // // Routes
// // app.get('/health', (req, res) => res.status(200).send('ok'));
// // app.get('/', (req, res) => res.json({ message: 'Server is running!' }));
// // app.use('/api/payment', paymentRoutes);
// // app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// // // Error handler
// // app.use((err, req, res, next) => {
// //   if (err?.type === 'entity.too.large') {
// //     return res.status(413).json({ error: 'Payload too large' });
// //   }
// //   if (err instanceof SyntaxError && 'body' in err) {
// //     return res.status(400).json({ error: 'Invalid JSON payload' });
// //   }
// //   console.error('Unhandled error:', err?.message || err);
// //   res.status(500).json({ error: err?.message || 'Internal Server Error' });
// // });

// // // ---- Google Sheets Auth ----
// // async function verifyGoogleAuth() {
// //   try {
// //     const rawCreds = process.env.TEDX_GOOGLE_CREDENTIALS;
// //     if (!rawCreds) {
// //       throw new Error('Missing TEDX_GOOGLE_CREDENTIALS in env vars');
// //     }

// //     let creds;
// //     try {
// //       creds = JSON.parse(rawCreds);
// //     } catch (err) {
// //       throw new Error('Invalid JSON in TEDX_GOOGLE_CREDENTIALS (check escaping)');
// //     }

// //     if (!creds.private_key || !creds.client_email) {
// //       throw new Error('Missing client_email or private_key in TEDX_GOOGLE_CREDENTIALS');
// //     }

// //     // Fix private key newlines
// //     creds.private_key = creds.private_key.replace(/\\n/g, '\n');

// //     const auth = new google.auth.JWT({
// //       email: creds.client_email,
// //       key: creds.private_key,
// //       scopes: ['https://www.googleapis.com/auth/spreadsheets'],
// //     });

// //     await auth.authorize();
// //     console.log('✅ Google Sheets auth OK');
// //     return auth;
// //   } catch (err) {
// //     console.error('❌ Google auth failed:', err.message);
// //     return null;
// //   }
// // }

// // // ---- Start server ----
// // (async () => {
// //   try {
// //     await connectDB();
// //     await verifyGoogleAuth();
// //     app.listen(PORT, () => console.log(`🚀 HTTP server listening on port ${PORT}`));
// //   } catch (e) {
// //     console.error('❌ Failed to start server:', e?.message || e);
// //     process.exit(1);
// //   }
// // })();

// // module.exports = app;

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


require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { google } = require("googleapis");
const { connectDB } = require("./utils/db");
const paymentRoutes = require("./paymentRoutes");
const fetch = require("node-fetch"); // For self-ping to reduce cold start
const Razorpay = require("razorpay");
// Add these imports at the top for Health Bot
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const PORT = process.env.PORT || 4000;
// Allowed origins - Updated with your custom domains
const allowedOrigins = [
  "https://www.tedxdypakurdi.com",      // Your custom domain
  "https://tedxdypakurdi.com",          // Your custom domain without www
  "https://tedx-dyp-akurdi.vercel.app",
  "https://tedxdev.netlify.app",
  "http://localhost:3000",
  "http://localhost:1234",
  "http://127.0.0.1:1234",
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/.+-saurabhmelgirkars-projects\.vercel\.app$/,
];
const app = express();
const BODY_LIMIT = process.env.BODY_LIMIT || "10mb";
// Middleware
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));
app.use(morgan("tiny"));
// CORS Configuration
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
// Enhanced Health Bot System
class HealthBot {
  constructor() {
    this.startTime = Date.now();
    this.healthChecks = new Map();
    this.alerts = [];
  }
  registerService(name, checkFunction) {
    this.healthChecks.set(name, checkFunction);
  }
  async checkSystemHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {},
      system: {},
      performance: {},
      alerts: this.alerts
    };
    try {
      // System metrics
      health.system = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpus: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
        freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB',
        loadAverage: os.loadavg(),
        hostname: os.hostname()
      };
      // Performance metrics
      const memUsage = process.memoryUsage();
      health.performance = {
        memoryUsage: {
          rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
          external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
        },
        cpuUsage: process.cpuUsage()
      };
      // Check all registered services
      for (const [serviceName, checkFn] of this.healthChecks) {
        try {
          const serviceHealth = await checkFn();
          health.services[serviceName] = {
            status: 'healthy',
            ...serviceHealth
          };
        } catch (error) {
          health.services[serviceName] = {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          };
          health.status = 'degraded';
        }
      }
      // Overall health determination
      const unhealthyServices = Object.values(health.services)
        .filter(service => service.status === 'unhealthy');
      
      if (unhealthyServices.length > 0) {
        health.status = unhealthyServices.length === Object.keys(health.services).length 
          ? 'unhealthy' : 'degraded';
      }
    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }
    return health;
  }
  addAlert(level, message, service = null) {
    const alert = {
      level,
      message,
      service,
      timestamp: new Date().toISOString()
    };
    
    this.alerts.unshift(alert);
    if (this.alerts.length > 50) this.alerts.pop();
    
    console.log(`🚨 [${level.toUpperCase()}] ${message}${service ? ` (${service})` : ''}`);
  }
}
// Initialize Health Bot
const healthBot = new HealthBot();
// Register service health checks
healthBot.registerService('database', async () => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database not connected');
  }
  return { 
    connection: 'active',
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    db: mongoose.connection.name
  };
});
healthBot.registerService('googleSheets', async () => {
  const auth = await verifyGoogleAuth();
  if (!auth) {
    throw new Error('Google Sheets authentication failed');
  }
  return { 
    authenticated: true,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  };
});
healthBot.registerService('razorpay', async () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured');
  }
  return {
    configured: true,
    keyId: process.env.RAZORPAY_KEY_ID ? 'present' : 'missing'
  };
});
// Routes
// Enhanced Health Endpoint
app.get("/health", async (req, res) => {
  try {
    const health = await healthBot.checkSystemHealth();
    const statusCode = health.status === 'healthy' ? 200 :
                      health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check system failure',
      timestamp: new Date().toISOString()
    });
  }
});
app.get("/", (req, res) => res.json({ message: "TEDx Server is running!" }));
// Razorpay Payment Routes
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const { amount, currency = "INR" } = req.body;
    
    const options = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt: `receipt_order_${Date.now()}`,
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);
    
    // Log successful order creation
    healthBot.addAlert('info', `Order created: ${order.id}`, 'razorpay');
    
    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    healthBot.addAlert('error', `Failed to create order: ${error.message}`, 'razorpay');
    res.status(500).json({ 
      success: false,
      error: "Unable to create payment order" 
    });
  }
});
// Payment Success Handler
app.post("/api/payment/verify", async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    
    // TODO: Implement signature verification using crypto
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generated_signature = hmac.digest('hex');
    
    if (generated_signature === razorpay_signature) {
      // Payment is verified
      healthBot.addAlert('info', `Payment verified: ${razorpay_payment_id}`, 'razorpay');
      
      res.json({
        success: true,
        message: "Payment verified successfully",
        redirect_url: "/success"
      });
    } else {
      healthBot.addAlert('warning', `Payment verification failed: ${razorpay_payment_id}`, 'razorpay');
      res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    healthBot.addAlert('error', `Payment verification error: ${error.message}`, 'razorpay');
    res.status(500).json({
      success: false,
      message: "Payment verification failed"
    });
  }
});
app.use("/api/payment", paymentRoutes);
// Ticket routes for session recovery
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
    healthBot.addAlert('error', `Failed to fetch ticket: ${err.message}`, 'database');
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});
// 404 Handler
app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));
// Error Handler
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  console.error("Unhandled error:", err?.message || err);
  healthBot.addAlert('error', `Unhandled error: ${err?.message}`, 'server');
  res.status(500).json({ error: err?.message || "Internal Server Error" });
});
// Google Sheets Auth Function
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
      throw new Error("Invalid JSON in TEDX_GOOGLE_CREDENTIALS (check escaping)");
    }
    if (!creds.private_key || !creds.client_email) {
      throw new Error("Missing client_email or private_key in TEDX_GOOGLE_CREDENTIALS");
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
// Start Server with Cold Start Optimization
(async () => {
  try {
    await connectDB();
    await verifyGoogleAuth();
    
    app.listen(PORT, () => {
      console.log(`🚀 TEDx Server running on port ${PORT}`);
      healthBot.addAlert('info', 'Server started successfully', 'server');
      
      // Self-ping to reduce cold start (warmup)
      const healthUrl = process.env.SELF_PING_URL || `http://localhost:${PORT}/health`;
      setTimeout(() => {
        fetch(healthUrl)
          .then(res => {
            console.log(`🔥 Warmup ping successful: ${res.status}`);
            healthBot.addAlert('info', 'Warmup ping successful', 'server');
          })
          .catch(err => {
            console.error("Warmup ping failed:", err.message);
            healthBot.addAlert('warning', 'Warmup ping failed', 'server');
          });
      }, 3000); // Wait 3 seconds after server start
    });
  } catch (e) {
    console.error("❌ Failed to start server:", e?.message || e);
    process.exit(1);
  }
})();
module.exports = app;

