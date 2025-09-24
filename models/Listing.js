import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },        // titlu anunț
    description: { type: String, required: true },  // descriere
    price: { type: Number, required: true },        // preț
    category: { type: String, required: true },     // categorie (apartamente, case, etc.)
    images: [{ type: String, required: true }],     // linkuri Cloudinary
  },
  { timestamps: true }
);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
