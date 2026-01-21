// models/User.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Numele este obligatoriu"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Emailul este obligatoriu"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Parola este obligatorie"],
    },

    // ✅ CÂMP TELEFON – lipsea!
phone: {
  type: String,
  trim: true,
},

// ✅ OLX-like cooldown pentru anunțuri gratuite
freeCooldownUntil: { type: Date, default: null },

verified: { type: Boolean, default: false },

    verified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
