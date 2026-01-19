// models/Listing.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ListingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, min: 0 },

    // categorizare & locație
    category: { type: String, trim: true },
    location: { type: String, trim: true },

    // imagini
    images: { type: [String], default: [] },
    imageUrl: { type: String, default: "" },

    // contact
    phone: { type: String, trim: true },
    email: { type: String, trim: true }, // ✅ acum se salvează corect

    // status general
    status: {
  type: String,
  enum: ["disponibil", "expirat"],
  default: "disponibil",
},
    rezervat: { type: Boolean, default: false },

    // relație user
    user: { type: Schema.Types.ObjectId, ref: "User" },

    // 🔹 câmpuri noi
    floor: { type: Number, min: 0, max: 50 },
    surface: { type: Number, min: 0 },
    rooms: { type: Number, min: 1, max: 10 },

    // 🔹 tip ofertă (păstrat exact ca înainte)
    dealType: {
      type: String,
      enum: ["vanzare", "inchiriere"],
      default: "vanzare",
    },

    // 🆕 🔹 scopul anunțului — NOU câmp pentru (vand / inchiriez / cumpar / schimb)
    intent: {
      type: String,
      enum: ["vand", "inchiriez", "cumpar", "schimb"],
      default: "vand",
    },

    // 🔹 câmp pentru promovare
    featuredUntil: { type: Date, default: null },
    featured: { type: Boolean, default: false }, // ✅ folosit la Stripe/confirm

    // opționale moștenite
    userEmail: { type: String, trim: true },

    // 🆕 Limitare anunț gratuit
    isFree: { type: Boolean, default: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 zile
    },
  },
  { timestamps: true }
);

// indexuri utile
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ category: 1 });
ListingSchema.index({ location: 1 });
ListingSchema.index({ dealType: 1 });
ListingSchema.index({ intent: 1 }); // 🔹 index suplimentar pt filtrare după tip (vand/inchiriez/cumpar/schimb)
ListingSchema.index({ expiresAt: 1 }); // 🔹 index suplimentar pt expirări

export default mongoose.model("Listing", ListingSchema);
