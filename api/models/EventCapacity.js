// // api/models/EventCapacity.js
// const mongoose = require('mongoose');

// const EventCapacitySchema = new mongoose.Schema(
//   {
//     // Unique event key
//     eventId: { type: String, required: true, unique: true, index: true, trim: true },

//     // Seats and derived units (2 units per seat)
//     totalSeats: { type: Number, required: true, min: 0 },      // e.g., 400
//     totalUnits: { type: Number, required: true, min: 0 },      // totalSeats * 2
//     usedUnits:  { type: Number, required: true, min: 0, default: 0 },

//     // Counters
//     fullDay:        { type: Number, default: 0, min: 0 },      // number of full-day tickets
//     morningSingles: { type: Number, default: 0, min: 0 },      // morning-only tickets
//     eveningSingles: { type: Number, default: 0, min: 0 },      // evening-only tickets
//   },
//   { versionKey: false, timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
// );

// // Derived availability (not stored)
// EventCapacitySchema.virtual('morningAvailable').get(function () {
//   return Math.max(0, this.totalSeats - (this.fullDay + this.morningSingles));
// });
// EventCapacitySchema.virtual('eveningAvailable').get(function () {
//   return Math.max(0, this.totalSeats - (this.fullDay + this.eveningSingles));
// });
// EventCapacitySchema.virtual('fullDayAvailable').get(function () {
//   // A full-day seat requires a seat available in BOTH morning and evening
//   return Math.min(this.morningAvailable, this.eveningAvailable);
// });

// // Defensive normalization to keep values in range
// EventCapacitySchema.pre('validate', function (next) {
//   if (!Number.isFinite(this.totalSeats) || this.totalSeats < 0) this.totalSeats = 0;
//   if (!Number.isFinite(this.totalUnits) || this.totalUnits < 0) this.totalUnits = this.totalSeats * 2;
//   if (!Number.isFinite(this.usedUnits) || this.usedUnits < 0) this.usedUnits = 0;

//   // Clamp usedUnits to totalUnits (never exceed)
//   if (this.usedUnits > this.totalUnits) this.usedUnits = this.totalUnits;

//   // Ensure counters are non-negative integers
//   for (const k of ['fullDay', 'morningSingles', 'eveningSingles']) {
//     const v = Number(this[k]);
//     this[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
//   }
//   next();
// });

// // Helpful index for reporting
// EventCapacitySchema.index({ eventId: 1, updatedAt: -1 });

// // Reuse if already compiled to avoid OverwriteModelError
// module.exports = mongoose.models.EventCapacity || mongoose.model('EventCapacity', EventCapacitySchema);


const mongoose = require('mongoose');

const EventCapacitySchema = new mongoose.Schema(
  {
    // Unique event key
    eventId: { type: String, required: true, unique: true, index: true, trim: true },
    
    // Seats configuration
    totalSeats: { type: Number, required: true, min: 0 },      // e.g., 6
    
    // REMOVED: totalUnits and usedUnits - these were causing confusion
    // We'll calculate availability directly from session counts
    
    // Session counters
    fullDay:        { type: Number, default: 0, min: 0 },      // number of full-day tickets
    morningSingles: { type: Number, default: 0, min: 0 },      // morning-only tickets
    eveningSingles: { type: Number, default: 0, min: 0 },      // evening-only tickets
    
    // ADDED: Version field for optimistic concurrency control
    version: { type: Number, default: 0, min: 0 },             // incremented on each update
  },
  { 
    versionKey: false, // We're using our custom version field instead of __v
    timestamps: true, 
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true } 
  }
);

// Derived availability calculations (not stored in database)
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

// ADDED: Virtual for total occupied seats (useful for debugging)
EventCapacitySchema.virtual('totalOccupied').get(function () {
  return Math.max(
    this.fullDay + this.morningSingles, // morning session occupancy
    this.fullDay + this.eveningSingles  // evening session occupancy
  );
});

// Defensive normalization and validation
EventCapacitySchema.pre('validate', function (next) {
  // Ensure totalSeats is valid
  if (!Number.isFinite(this.totalSeats) || this.totalSeats < 0) {
    this.totalSeats = 400; // Default to 6 seats
  }
  
  // Ensure version is valid
  if (!Number.isFinite(this.version) || this.version < 0) {
    this.version = 0;
  }
  
  // Ensure all counters are non-negative integers
  for (const field of ['fullDay', 'morningSingles', 'eveningSingles']) {
    const value = Number(this[field]);
    this[field] = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }
  
  // ADDED: Validation to prevent logical inconsistencies
  const morningOccupied = this.fullDay + this.morningSingles;
  const eveningOccupied = this.fullDay + this.eveningSingles;
  
  if (morningOccupied > this.totalSeats) {
    return next(new Error(`Morning sessions exceed total seats: ${morningOccupied} > ${this.totalSeats}`));
  }
  
  if (eveningOccupied > this.totalSeats) {
    return next(new Error(`Evening sessions exceed total seats: ${eveningOccupied} > ${this.totalSeats}`));
  }
  
  next();
});

// ADDED: Pre-save middleware to increment version on updates
EventCapacitySchema.pre('save', function(next) {
  // Only increment version if this is an update (not initial creation)
  if (!this.isNew && this.isModified(['fullDay', 'morningSingles', 'eveningSingles', 'totalSeats'])) {
    this.version += 1;
  }
  next();
});

// ADDED: Static method for atomic seat reservation with version check
EventCapacitySchema.statics.reserveSeat = async function(eventId, sessionType, transactionSession) {
  const filter = { eventId };
  let inc = { version: 1 };
  
  // Get current capacity first
  const currentCap = await this.findOne(filter, null, { session: transactionSession });
  if (!currentCap) {
    throw new Error('EVENT_NOT_FOUND');
  }
  
  // Check availability and set increment based on session type
  if (sessionType === 'fullDay') {
    const morningOccupied = currentCap.fullDay + currentCap.morningSingles;
    const eveningOccupied = currentCap.fullDay + currentCap.eveningSingles;
    
    if (morningOccupied >= currentCap.totalSeats || eveningOccupied >= currentCap.totalSeats) {
      throw new Error('SOLD_OUT');
    }
    inc.fullDay = 1;
  } else if (sessionType === 'morning') {
    const morningOccupied = currentCap.fullDay + currentCap.morningSingles;
    if (morningOccupied >= currentCap.totalSeats) {
      throw new Error('SOLD_OUT');
    }
    inc.morningSingles = 1;
  } else if (sessionType === 'evening') {
    const eveningOccupied = currentCap.fullDay + currentCap.eveningSingles;
    if (eveningOccupied >= currentCap.totalSeats) {
      throw new Error('SOLD_OUT');
    }
    inc.eveningSingles = 1;
  } else {
    throw new Error('INVALID_SESSION_TYPE');
  }
  
  // Atomic update with version check (optimistic concurrency control)
  const updatedCap = await this.findOneAndUpdate(
    { 
      eventId,
      version: currentCap.version // This ensures no other transaction modified the document
    },
    { $inc: inc },
    { 
      new: true, 
      session: transactionSession,
      runValidators: true 
    }
  );
  
  if (!updatedCap) {
    throw new Error('SOLD_OUT'); // Version conflict or capacity exceeded
  }
  
  return updatedCap;
};

// Indexes for performance
EventCapacitySchema.index({ eventId: 1, version: 1 }); // For atomic updates
EventCapacitySchema.index({ eventId: 1, updatedAt: -1 }); // For reporting

// Reuse if already compiled to avoid OverwriteModelError
module.exports = mongoose.models.EventCapacity || mongoose.model('EventCapacity', EventCapacitySchema);
