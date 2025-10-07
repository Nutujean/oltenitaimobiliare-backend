// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,   // ✅ index unic declarat O SINGURĂ DATĂ aici
    },
    passwordHash: { type: String, required: true },

    // Dacă folosești verificare email:
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// ❌ NU mai adăuga userSchema.index({ email: 1 }, { unique: true })
// ❌ NU mai pune "index: true" separat pe email

export default mongoose.model("User", userSchema);
