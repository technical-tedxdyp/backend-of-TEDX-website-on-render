// models/Ticket.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const TicketSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      maxlength: 160,
    },
    phone: { type: String, required: true, trim: true, maxlength: 32 },

    department: { type: String, trim: true, default: '', maxlength: 120 },
    branch: { type: String, trim: true, default: '', maxlength: 120 },

    // 'morning' | 'evening' | 'fullDay'
    session: {
      type: String,
      enum: ['morning', 'evening', 'fullDay'],
      required: true,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },

    razorpayOrderId:   { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, required: true, unique: true, index: true },
    razorpaySignature: { type: String, required: true },

    // Controller sets friendly code like TEDX-00001; fallback guarantees non-null
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: function () {
        return `T-${uuidv4()}`;
      },
    },

    // Optional client-sent key to deduplicate manual retries
    idempotencyKey: { type: String, index: true, sparse: true, maxlength: 120 },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.razorpaySignature; // don’t leak signatures in API responses
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Helpful indexes
TicketSchema.index({ email: 1, createdAt: -1 });
TicketSchema.index({ session: 1, createdAt: -1 });

// Normalization
TicketSchema.pre('validate', function (next) {
  if (typeof this.email === 'string') this.email = this.email.toLowerCase().trim();
  if (typeof this.name === 'string') this.name = this.name.trim();
  if (typeof this.phone === 'string') this.phone = this.phone.trim();
  if (typeof this.department === 'string') this.department = this.department.trim();
  if (typeof this.branch === 'string') this.branch = this.branch.trim();
  if (!Number.isFinite(this.amount) || this.amount < 0) this.amount = 0;
  next();
});

// Safe public payload helper
TicketSchema.methods.toPublic = function toPublic() {
  const obj = this.toObject({ virtuals: true });
  delete obj.razorpaySignature;
  return obj;
};

// Reuse if already compiled to prevent OverwriteModelError
module.exports = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
