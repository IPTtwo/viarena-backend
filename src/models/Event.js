import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    venue: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    deadline: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1 },
    registeredCount: { type: Number, default: 0, min: 0 },
    visibility: {
      type: String,
      enum: ["Draft", "Published"],
      default: "Draft",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coOrganizers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        permissions: { type: [String], default: ["viewRegistrations"] },
      },
    ],
    cover: { type: String, default: "" },
  },
  { timestamps: true },
);
schema.index({ visibility: 1, start: 1 });
schema.index({ title: "text", description: "text" });
export default mongoose.model("Event", schema);
