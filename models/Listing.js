import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    location: { type: String, required: true },   // 📌 locația adăugată
    images: [{ type: String, required: true }],
  },
  { timestamps: true }
);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
