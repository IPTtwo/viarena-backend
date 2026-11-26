import crypto from 'node:crypto';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { asyncHandler, fail } from '../utils/http.js';
export const hashToken = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const raw = req.cookies?.[process.env.COOKIE_NAME || 'viarena_session'];
  if (!raw) throw fail(401, 'Authentication required');
  const session = await Session.findOne({
    tokenHash: hashToken(raw),
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw fail(401, 'Session expired');
  const user = await User.findById(session.userId);
  if (!user) throw fail(401, 'Account unavailable');
  req.user = user;
  req.sessionRecord = session;
  next();
});
export const requireRole = (role) => (req, _res, next) =>
  req.user?.roles.some((value) => value === role || value === 'Admin')
    ? next()
    : next(fail(403, 'Forbidden'));
export const optionalAuth = (req, res, next) => {
  if (!req.cookies?.[process.env.COOKIE_NAME || 'viarena_session']) return next();
  requireAuth(req, res, (error) => (error?.status === 401 ? next() : next(error)));
};
export function canManage(event, user, permission = 'edit') {
  if (user.roles.includes('Admin')) return true;
  if (String(event.ownerId) === String(user._id) && user.roles.includes('Organizer'))
    return true;
  const aliases = {
    edit: ['edit', 'manage_event'],
    publish: ['publish', 'manage_event'],
    viewRegistrations: [
      'viewRegistrations',
      'manage_registrations',
      'manage_teams',
      'manage_participation',
    ],
    manageRegistrations: ['manageRegistrations', 'manage_registrations'],
  };
  return event.coOrganizers?.some(
    (c) =>
      String(c.userId) === String(user._id) &&
      c.permissions.some((value) => (aliases[permission] || [permission]).includes(value)),
  );
}
