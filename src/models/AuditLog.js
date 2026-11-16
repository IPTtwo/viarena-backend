import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    action: { type: String, required: true },
    reason: String,
    details: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);
export default mongoose.model("AuditLog", schema);
