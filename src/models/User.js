import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    studentId: { type: String, required: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    roles: {
      type: [String],
      default: ["Participant"],
      enum: ["Participant", "Organizer", "Admin"],
    },
    bio: { type: String, default: "" },
    avatar: { type: String, default: "" },
    resetHash: String,
    resetExpires: Date,
  },
  { timestamps: true },
);
schema.set("toJSON", {
  transform: (_doc, obj) => {
    delete obj.passwordHash;
    delete obj.resetHash;
    delete obj.resetExpires;
    delete obj.__v;
    obj.id = String(obj._id);
    delete obj._id;
    return obj;
  },
});
export default mongoose.model("User", schema);
