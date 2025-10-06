import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, required: true },
    location: { type: String, required: true },
    floor:   { type: Number, min: 0, max: 50 }, // Etaj (0 = Parter)
    surface: { type: Number, min: 0 },          // Suprafață utilă în mp
    rooms:   { type: Number, min: 1, max: 10 }, // Număr camere

    price: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["vanzare", "inchiriere"], default: "vanzare" },
    phone: { type: String, required: true }, // 🔹 număr de telefon obligatoriu
    imageUrl: { type: String, default: "" }, // o singură imagine
    images: { type: [String], default: [] }, // galerie imagini
    status: {
    transactionType: { type: String, enum: ["vanzare", "inchiriere"], default: "vanzare", index: true },

      type: String,
      enum: ["disponibil", "rezervat", "vandut"],
      default: "disponibil",
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Listing", listingSchema);
