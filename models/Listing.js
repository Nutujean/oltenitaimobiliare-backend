import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({
  titlu: { type: String, required: true },
  descriere: { type: String, required: true },
  pret: { type: Number, required: true },
  categorie: { type: String, required: true },
  images: [{ type: String }]
}, { timestamps: true });

const Listing = mongoose.model("Listing", listingSchema);
export default Listing;
