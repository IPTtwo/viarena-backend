import { Router } from 'express';
import { z } from 'zod';
import User from '../models/User.js';
import Event from '../models/Event.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, fail, validId } from '../utils/http.js';
const router = Router();
router.use(requireAuth, requireRole('Admin'));
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = 20;
    const [users, total] = await Promise.all([
      User.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(),
    ]);
    res.json({ users, total, page });
  }),
);
router.get(
  '/users/:userId',
  asyncHandler(async (req, res) => {
    if (!validId(req.params.userId)) throw fail(400, 'Invalid user ID');
    const user = await User.findById(req.params.userId);
    if (!user) throw fail(404, 'User not found');
    res.json({ user });
  }),
);
router.post(
  '/users/:userId/organizer-role',
  asyncHandler(async (req, res) => {
    const { grant, reason } = z
      .object({ grant: z.boolean(), reason: z.string().min(5).max(500) })
      .parse(req.body);
    if (!validId(req.params.userId)) throw fail(400, 'Invalid user ID');
    const user = await User.findById(req.params.userId);
    if (!user) throw fail(404, 'User not found');
    if (String(user._id) === String(req.user._id) || user.roles.includes('Admin'))
      throw fail(403, 'This account cannot be changed');
    if (!grant && (await Event.exists({ ownerId: user._id })))
      throw fail(409, 'Reassign owned events before revoking Organizer');
    const previousRoles = [...user.roles];
    if (grant && !user.roles.includes('Organizer')) user.roles.push('Organizer');
    if (!grant) user.roles = user.roles.filter((r) => r !== 'Organizer');
    await user.save();
    await AuditLog.create({
      actorId: req.user._id,
      targetUserId: user._id,
      action: grant ? 'role.organizer.grant' : 'role.organizer.revoke',
      reason,
      details: { previousRoles, nextRoles: [...user.roles] },
    });
    res.json({ user });
  }),
);
router.get(
  '/users/:userId/role-history',
  asyncHandler(async (req, res) => {
    if (!validId(req.params.userId)) throw fail(400, 'Invalid user ID');
    const logs = await AuditLog.find({
      targetUserId: req.params.userId,
      action: /^role\./,
    })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ logs });
  }),
);
export default router;