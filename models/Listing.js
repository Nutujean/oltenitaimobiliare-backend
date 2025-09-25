import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
      type: String,
      enum: ["Apartamente", "Case", "Terenuri", "Garsoniere", "Garaje", "Spațiu comercial"],
      required: true,
    },
    location: { type: String, required: true },
    images: [{ type: String }], // link-uri Cloudinary
    phone: { type: String },    // 📞 număr de telefon
    email: { type: String },    // ✉️ email de contact
  },
  { timestamps: true }
);

const Listing = mongoose.model("Listing", listingSchema);
export default Listing;
