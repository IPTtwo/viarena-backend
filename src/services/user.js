import User from "../models/User.js";

export function updateProfile(userId, updates) {
  return User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  );
}
