const mongoose = require('mongoose');

let isConnected = 0; // 0 = disconnected, 1 = connected
let isTxnReady = false; // whether the deployment supports transactions (replica set)

// Safer queries and predictable casting
mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB with enhanced error handling and logging.
 * Reuses the existing connection across hot reloads / serverless spins.
 */
const connectDB = async () => {
  if (isConnected === 1) {
    console.log('✅ Using existing MongoDB connection');
    return mongoose.connection;
  }

  const mongoURI = process.env.TEDX_MONGO_URI;
  if (!mongoURI) {
    console.error('❌ CRITICAL: TEDX_MONGO_URI not found in environment variables');
    throw new Error('MongoDB URI not found. Set TEDX_MONGO_URI in environment variables.');
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10
      });

      isConnected = mongoose.connection.readyState; // 1 when connected
      console.log('✅ MongoDB connected successfully');

      // Detect transaction capability (replica set / sharded)
      if (mongoose.connection.db) {
        try {
          const admin = mongoose.connection.db.admin();
          const replStatus = await admin.replSetGetStatus().catch(() => null);
          isTxnReady = Boolean(replStatus && replStatus.ok === 1);
          
          if (isTxnReady) {
            console.log('🧾 Transactions available (replica set detected)');
          } else {
            console.log('ℹ️ Transactions not available (standalone). Atomic single-doc updates still work.');
          }
        } catch (err) {
          console.warn('⚠️ Could not check replica set status:', err.message);
          isTxnReady = false;
        }
      }

      return mongoose.connection;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${attempt} failed: ${err.message}`);
      
      if (attempt < MAX_RETRIES) {
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
        console.log('↻ Retrying MongoDB connection...');
      } else {
        console.error('💡 Check your TEDX_MONGO_URI environment variable in Render dashboard');
        throw new Error('Failed to connect to MongoDB after multiple attempts');
      }
    }
  }
};

/**
 * Utility: run a function within a MongoDB transaction when supported.
 * Falls back to a direct call if transactions aren't available.
 */
const withTransaction = async (fn) => {
  if (!isTxnReady) {
    console.warn('⚠️ Transactions not supported on this MongoDB deployment. Running without a session.');
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (transactionError) {
    console.error('❌ Transaction failed:', transactionError.message);
    throw transactionError;
  } finally {
    session.endSession();
  }
};

// Enhanced connection event logs
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose event: connected');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 Mongoose event: reconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose event: connection error', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose event: disconnected');
});

// Graceful shutdown (Render sends SIGTERM on deploys)
const gracefulExit = async (signal) => {
  try {
    await mongoose.connection.close();
    console.log(`✅ Mongoose connection closed gracefully on ${signal}`);
  } catch (e) {
    console.error('❌ Error during Mongoose close:', e.message);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulExit('SIGINT'));
process.on('SIGTERM', () => gracefulExit('SIGTERM'));

module.exports = {
  connectDB,
  withTransaction,
};
