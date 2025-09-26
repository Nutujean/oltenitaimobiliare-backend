import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// 👇 verificăm dacă există deja modelul, altfel îl creăm
export default mongoose.models.User || mongoose.model("User", userSchema);
