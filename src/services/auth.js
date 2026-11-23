import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { hashToken } from "../middleware/auth.js";

const sessionDays = () => Number(process.env.SESSION_DAYS) || 7;

export async function createParticipant({ name, email, studentId, password }) {
  if (await User.exists({ $or: [{ email }, { studentId }] })) {
    const error = new Error("Email or student ID already registered");
    error.status = 409;
    throw error;
  }
  return User.create({
    name,
    email,
    studentId,
    passwordHash: await bcrypt.hash(password, 12),
    roles: ["Participant"],
  });
}

export async function authenticate(email, password) {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error("Invalid credentials");
    error.status = 401;
    throw error;
  }
  const rawToken = crypto.randomBytes(32).toString("hex");
  const days = sessionDays();
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + days * 86400000),
  });
  return { user, rawToken, days };
}

export async function removeSession(rawToken) {
  if (rawToken) await Session.deleteOne({ tokenHash: hashToken(rawToken) });
}

export async function issuePasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user) return null;
  const token = crypto.randomBytes(32).toString("hex");
  user.resetHash = hashToken(token);
  user.resetExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  return token;
}

export async function resetPassword(token, password) {
  const user = await User.findOne({
    resetHash: hashToken(token),
    resetExpires: { $gt: new Date() },
  });
  if (!user) {
    const error = new Error("Invalid or expired reset token");
    error.status = 400;
    throw error;
  }
  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetHash = undefined;
  user.resetExpires = undefined;
  await user.save();
  await Session.deleteMany({ userId: user._id });
}
