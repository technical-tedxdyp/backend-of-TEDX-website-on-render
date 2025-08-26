// models/Counter.js
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema(
  {
    // Use string keys like "ticketId", "invoice", etc.
    _id: { type: String, required: true, trim: true },
    sequence_value: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false, timestamps: false }
);

// Ensure stable lookup
CounterSchema.index({ _id: 1 }, { unique: true });

// Reuse if already compiled
module.exports = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
