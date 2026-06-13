// models/ListingViewEvent.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ListingViewEventSchema = new Schema(
  {
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
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

ListingViewEventSchema.index({ listing: 1, viewedAt: -1 });

export default mongoose.model("ListingViewEvent", ListingViewEventSchema);
