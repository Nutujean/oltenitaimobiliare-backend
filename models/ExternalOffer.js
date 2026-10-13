import mongoose from "mongoose";

const ExternalOfferSchema = new mongoose.Schema({
  sourceId: { type: String, required: true },
  sourceName: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  sourcePublishedAt: { type: Date, required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  locality: { type: String, required: true },
  county: { type: String, default: "Călărași", immutable: true },
  category: { type: String, required: true },
  intent: { type: String, required: true },
  priceEUR: { type: Number, default: null },
  publishedDay: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

ExternalOfferSchema.index({ sourceUrl: 1 }, { unique: true });
ExternalOfferSchema.index({ publishedDay: 1 });
ExternalOfferSchema.index({ active: 1, expiresAt: 1, createdAt: -1 });

export default mongoose.model("ExternalOffer", ExternalOfferSchema);
