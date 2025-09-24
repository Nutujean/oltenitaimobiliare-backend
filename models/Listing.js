import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },       // Titlu anunț
    description: { type: String, required: true }, // Descriere
    price: { type: Number, required: true },       // Preț
    category: { type: String, required: true },    // Categoria (Apartamente, Case, etc.)
    location: { type: String, required: true },    // Locația (Oltenița, Chirnogi, etc.)
    phone: { type: String, required: false },      // Telefon (opțional)
    email: { type: String, required: false },      // Email (opțional)
    images: [{ type: String, required: false }],   // Array de linkuri Cloudinary
  },
  { timestamps: true }
);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
