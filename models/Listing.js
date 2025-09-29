import mongoose from "mongoose";

const ListingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: "" },     // o singură imagine (opțional)
    images: { type: [String], default: [] },     // galerii (opțional)
    status: {
      type: String,
      enum: ["disponibil", "rezervat", "vandut"],
      default: "disponibil",
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // opțional
  },
  { timestamps: true }
);

export default mongoose.model("Listing", ListingSchema);
