import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    images: {
      type: [String], // linkuri imagini Cloudinary
      default: [],
    },
  },
  { timestamps: true } // adaugă automat createdAt și updatedAt
);

export default mongoose.model("Listing", listingSchema);
