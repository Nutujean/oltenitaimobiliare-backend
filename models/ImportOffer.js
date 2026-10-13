import mongoose from "mongoose";

const { Schema } = mongoose;
const ImportOfferSchema = new Schema({
  sourceId: { type: String, required: true },
  externalId: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  consentReference: { type: String, required: true },
  county: { type: String, required: true },
  location: { type: String, required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: "" },
  intent: { type: String, required: true },
  images: { type: [String], required: true },
  rightsGranted: { type: Boolean, required: true },
  available: { type: Boolean, required: true },
  lastSeenAt: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ["queued", "published", "duplicate", "withdrawn", "invalid"], default: "queued" },
  listing: { type: Schema.Types.ObjectId, ref: "Listing", default: null },
  lastError: { type: String, default: "" },
}, { timestamps: true });
ImportOfferSchema.index({ sourceId: 1, externalId: 1 }, { unique: true });
ImportOfferSchema.index({ status: 1, lastSeenAt: -1 });
export default mongoose.model("ImportOffer", ImportOfferSchema);
