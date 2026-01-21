// models/Listing.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ListingSchema = new Schema(
  {
    // =========================
    // INFORMAȚII DE BAZĂ
    // =========================
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, min: 0 },

    // =========================
    // CATEGORIZARE & LOCAȚIE
    // =========================
    category: { type: String, trim: true },
    location: { type: String, trim: true },

    // =========================
    // IMAGINI
    // =========================
    images: { type: [String], default: [] },
    imageUrl: { type: String, default: "" },

    // =========================
    // CONTACT
    // =========================
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    userEmail: { type: String, trim: true },

    // =========================
    // STATUS PUBLIC (NU SE ATINGE)
    // =========================
    status: {
      type: String,
      enum: ["disponibil", "expirat"],
      default: "disponibil",
    },
    rezervat: { type: Boolean, default: false },

    // =========================
    // VIZIBILITATE (CHEIA SOLUȚIEI)
    // public  → apare pe site
    // draft   → apare DOAR la "Anunțurile mele"
    // =========================
    visibility: {
      type: String,
      enum: ["public", "draft"],
      default: "public",
    },

    // =========================
    // UTILIZATOR
    // =========================
    user: { type: Schema.Types.ObjectId, ref: "User" },

    // =========================
    // DETALII OPȚIONALE
    // =========================
    floor: { type: Number, min: 0, max: 50 },
    surface: { type: Number, min: 0 },
    rooms: { type: Number, min: 1, max: 10 },

    // =========================
    // TIP OFERTĂ
    // =========================
    dealType: {
      type: String,
      enum: ["vanzare", "inchiriere"],
      default: "vanzare",
    },

    intent: {
      type: String,
      enum: ["vand", "inchiriez", "cumpar", "schimb"],
      default: "vand",
    },

    // =========================
    // PROMOVARE
    // =========================
    featured: { type: Boolean, default: false },
    featuredUntil: { type: Date, default: null },

    // =========================
    // REGULĂ FREE / PAID
    // =========================
    isFree: { type: Boolean, default: true },

    // FREE expiră la 15 zile
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// =========================
// INDEXURI
// =========================
ListingSchema.index({ createdAt: -1 });
ListingSchema.index({ category: 1 });
ListingSchema.index({ location: 1 });
ListingSchema.index({ dealType: 1 });
ListingSchema.index({ intent: 1 });
ListingSchema.index({ expiresAt: 1 });
ListingSchema.index({ visibility: 1 });

export default mongoose.model("Listing", ListingSchema);
