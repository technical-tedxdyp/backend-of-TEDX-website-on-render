// api/scripts/seedCapacity.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const EventCapacity = require('../models/EventCapacity'); // v2 units-based model

const MONGO = process.env.TEDX_MONGO_URI;
const EVENT_ID = process.env.TEDX_EVENT_ID || 'tedx-2025';

if (!MONGO) {
  console.error('Missing TEDX_MONGO_URI in api/.env');
  process.exit(1);
}

function toInt(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

(async () => {
  try {
    // Usage: node seedCapacity.js <totalSeats>
    const totalSeats = toInt(process.argv[4], 400);
    const totalUnits = totalSeats * 2;

    await mongoose.connect(MONGO);

    const doc = await EventCapacity.findOneAndUpdate(
      { eventId: EVENT_ID },
      {
        $set: {
          eventId: EVENT_ID,
          totalSeats,
          totalUnits,
          usedUnits: 0,
          fullDay: 0,
          morningSingles: 0,
          eveningSingles: 0,
        },
      },
      { upsert: true, new: true }
    );

    console.log('Seeded capacity:', {
      eventId: doc.eventId,
      totalSeats: doc.totalSeats,
      totalUnits: doc.totalUnits,
      usedUnits: doc.usedUnits,
      fullDay: doc.fullDay,
      morningSingles: doc.morningSingles,
      eveningSingles: doc.eveningSingles,
      updatedAt: doc.updatedAt,
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e?.message || e);
    process.exit(1);
  }
})();
