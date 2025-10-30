import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // se șterge automat după 5 minute
});

export default mongoose.model("Otp", otpSchema);
