import mongoose from "mongoose";
const LeaseSchema = new mongoose.Schema({
  _id: String,
  lockedUntil: { type: Date, default: () => new Date(0) },
});
export default mongoose.model("ImportLease", LeaseSchema);
