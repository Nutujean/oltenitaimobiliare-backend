// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,   // <- păstrăm unicitatea aici
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },

    // verificare email
    verified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpiresAt: { type: Date },
  },
  { timestamps: true }
);

// ❌ NU mai adăugăm încă o dată indexul pentru email ca schema.index(...)

const User = mongoose.model("User", userSchema);
export default User;
