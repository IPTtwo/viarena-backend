import crypto from "node:crypto";
import Session from "../models/Session.js";
import User from "../models/User.js";
import { asyncHandler, fail } from "../utils/http.js";
export const hashToken = (s) =>
  crypto.createHash("sha256").update(s).digest("hex");
async function restoreSession(req) {
  const raw = req.cookies?.[process.env.COOKIE_NAME || "viarena_session"];
  if (!raw) return;
  const session = await Session.findOne({
    tokenHash: hashToken(raw),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return;
  const user = await User.findById(session.userId);
  if (!user) return;
  req.user = user;
  req.sessionRecord = session;
}
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  await restoreSession(req);
  next();
});
export const requireAuth = asyncHandler(async (req, _res, next) => {
  await restoreSession(req);
  if (!req.user) throw fail(401, "Authentication required");
  next();
});
export const requireRole = (role) => (req, _res, next) =>
  req.user?.roles.some((value) => value === role || value === "Admin")
    ? next()
    : next(fail(403, "Forbidden"));
export function canManage(event, user, permission = "edit") {
  if (!user) return false;
  const equivalent = {
    edit: ["edit", "manage_event"],
    publish: ["publish", "manage_event"],
    viewRegistrations: ["viewRegistrations", "manage_registrations", "manage_teams", "manage_participation"],
    manageRegistrations: ["manageRegistrations", "manage_registrations"],
  };
  if (user.roles.includes("Admin")) return true;
  if (String(event.ownerId) === String(user._id) && user.roles.includes("Organizer")) return true;
  return !!event.coOrganizers?.some(
    (c) =>
      String(c.userId) === String(user._id) &&
      c.permissions.some((value) => (equivalent[permission] || [permission]).includes(value)),
  );
}
