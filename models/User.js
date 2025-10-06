// models/User.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, index: true, trim: true },
    password: { type: String, required: true },

    // verificare email
    isVerified: { type: Boolean, default: false },
    verifyToken: { type: String },

    // resetare parolă
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("User", UserSchema);
