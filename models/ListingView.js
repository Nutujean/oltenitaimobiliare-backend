// models/ListingView.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ListingViewSchema = new Schema(
  {
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    visitorKey: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

// Un vizitator poate fi numărat o singură dată pentru același anunț
// cât timp documentul există în colecție (24h).
ListingViewSchema.index({ listing: 1, visitorKey: 1 }, { unique: true });

export default mongoose.model("ListingView", ListingViewSchema);
