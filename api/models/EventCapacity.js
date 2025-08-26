// api/models/EventCapacity.js
const mongoose = require('mongoose');

const EventCapacitySchema = new mongoose.Schema(
  {
    // Unique event key
    eventId: { type: String, required: true, unique: true, index: true, trim: true },

    // Seats and derived units (2 units per seat)
    totalSeats: { type: Number, required: true, min: 0 },      // e.g., 400
    totalUnits: { type: Number, required: true, min: 0 },      // totalSeats * 2
    usedUnits:  { type: Number, required: true, min: 0, default: 0 },

    // Counters
    fullDay:        { type: Number, default: 0, min: 0 },      // number of full-day tickets
    morningSingles: { type: Number, default: 0, min: 0 },      // morning-only tickets
    eveningSingles: { type: Number, default: 0, min: 0 },      // evening-only tickets
  },
  { versionKey: false, timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Derived availability (not stored)
EventCapacitySchema.virtual('morningAvailable').get(function () {
  return Math.max(0, this.totalSeats - (this.fullDay + this.morningSingles));
});
EventCapacitySchema.virtual('eveningAvailable').get(function () {
  return Math.max(0, this.totalSeats - (this.fullDay + this.eveningSingles));
});
EventCapacitySchema.virtual('fullDayAvailable').get(function () {
  // A full-day seat requires a seat available in BOTH morning and evening
  return Math.min(this.morningAvailable, this.eveningAvailable);
});

// Defensive normalization to keep values in range
EventCapacitySchema.pre('validate', function (next) {
  if (!Number.isFinite(this.totalSeats) || this.totalSeats < 0) this.totalSeats = 0;
  if (!Number.isFinite(this.totalUnits) || this.totalUnits < 0) this.totalUnits = this.totalSeats * 2;
  if (!Number.isFinite(this.usedUnits) || this.usedUnits < 0) this.usedUnits = 0;

  // Clamp usedUnits to totalUnits (never exceed)
  if (this.usedUnits > this.totalUnits) this.usedUnits = this.totalUnits;

  // Ensure counters are non-negative integers
  for (const k of ['fullDay', 'morningSingles', 'eveningSingles']) {
    const v = Number(this[k]);
    this[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }
  next();
});

// Helpful index for reporting
EventCapacitySchema.index({ eventId: 1, updatedAt: -1 });

// Reuse if already compiled to avoid OverwriteModelError
module.exports = mongoose.models.EventCapacity || mongoose.model('EventCapacity', EventCapacitySchema);
