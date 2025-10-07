// models/Listing.js
import mongoose from "mongoose";
featuredUntil: { type: Date, default: null },

const { Schema } = mongoose;

const ListingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, min: 0 },

    // categorizare & locație
    category: { type: String, trim: true }, // ex: Apartamente, Garsoniere, Case, Terenuri, etc.
    location: { type: String, trim: true }, // ex: Oltenita, Chirnogi, etc.

    // imagini
    images: { type: [String], default: [] },
    imageUrl: { type: String, default: "" }, // fallback vechi

    // contact
    phone: { type: String, trim: true },

    // status general
    status: { type: String, default: "disponibil" },
    rezervat: { type: Boolean, default: false },

    // relație user
    user: { type: Schema.Types.ObjectId, ref: "User" },

    // 🔹 câmpuri noi
    floor: { type: Number, min: 0, max: 50 },     // Etaj (0=Parter)
    surface: { type: Number, min: 0 },            // Suprafață utilă (mp)
    rooms: { type: Number, min: 1, max: 10 },     // Număr camere

    // 🔹 tip ofertă: vânzare / închiriere
    dealType: {
      type: String,
      enum: ["vanzare", "inchiriere"],
      default: "vanzare",
    },

    // opționale moștenite
    userEmail: { type: String, trim: true }, // dacă ai folosit în trecut
  },
  { timestamps: true }
);

// indexuri utile
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ category: 1 });
ListingSchema.index({ location: 1 });
ListingSchema.index({ dealType: 1 });

export default mongoose.model("Listing", ListingSchema);
