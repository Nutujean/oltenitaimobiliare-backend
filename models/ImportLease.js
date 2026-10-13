import mongoose from "mongoose";
const LeaseSchema = new mongoose.Schema({
  _id: String,
  owner: { type: String, default: "" },
  lockedUntil: { type: Date, default: () => new Date(0) },
});
export default mongoose.model("ImportLease", LeaseSchema);
