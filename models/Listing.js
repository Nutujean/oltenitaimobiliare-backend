import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Titlul este obligatoriu"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Descrierea este obligatorie"],
    },
    price: {
      type: Number,
      required: [true, "Prețul este obligatoriu"],
      min: [0, "Prețul nu poate fi negativ"],
    },
    category: {
      type: String,
      required: [true, "Categoria este obligatorie"],
      enum: ["Apartament", "Casă", "Teren", "Garsonieră", "Garaj", "Spațiu comercial", "Altceva"],
    },
    location: {
      type: String,
      required: [true, "Locația este obligatorie"],
    },
    images: [
      {
        type: String, // stocăm link-ul de la Cloudinary
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // legătura cu utilizatorul care a adăugat anunțul
      required: false,
    },
  },
  { timestamps: true }
);

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
