import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, required: true },
    location: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["vanzare", "inchiriere"], default: "vanzare" },
    phone: { type: String, required: true }, // 🔹 număr de telefon obligatoriu
    imageUrl: { type: String, default: "" }, // o singură imagine
    images: { type: [String], default: [] }, // galerie imagini
    status: {
      type: String,
      enum: ["disponibil", "rezervat", "vandut"],
      default: "disponibil",
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Listing", listingSchema);
