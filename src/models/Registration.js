import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["Registered", "Cancelled"],
      default: "Registered",
    },
  },
  { timestamps: true },
);

schema.index({ eventId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Registration", schema);
