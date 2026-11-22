import { Router } from "express";
import { z } from "zod";
import Event from "../models/Event.js";
import AuditLog from "../models/AuditLog.js";
import { requireAuth, requireRole, canManage } from "../middleware/auth.js";
import { asyncHandler, fail, validId } from "../utils/http.js";
const router = Router();
const schema = z.object({
  title: z.string().min(3).max(200),
  category: z.string().min(2).max(80),
  description: z.string().max(10000).default(""),
  venue: z.string().min(2).max(200),
  start: z.coerce.date(),
  end: z.coerce.date(),
  deadline: z.coerce.date(),
  capacity: z.number().int().positive(),
  cover: z.string().max(2000).default(""),
});
const get = async (id) => {
  if (!validId(id)) throw fail(400, "Invalid event ID");
  const e = await Event.findById(id);
  if (!e) throw fail(404, "Event not found");
  return e;
};
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1)),
      limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const filter = { visibility: "Published" };
    if (req.query.category && req.query.category !== "All categories")
      filter.category = req.query.category;
    if (req.query.search)
      filter.$text = { $search: String(req.query.search).slice(0, 100) };
    if (req.query.status === "upcoming") filter.start = { $gte: new Date() };
    if (req.query.status === "past") filter.end = { $lt: new Date() };
    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ start: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(filter),
    ]);
    res.json({ events, total, page, pages: Math.ceil(total / limit) });
  }),
);
router.get(
  "/:eventId",
  asyncHandler(async (req, res) => {
    const event = await get(req.params.eventId);
    if (event.visibility !== "Published") throw fail(404, "Event not found");
    res.json({ event });
  }),
);
router.post(
  "/",
  requireAuth,
  requireRole("Organizer"),
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);
    if (body.end <= body.start || body.deadline > body.start)
      throw fail(400, "Invalid event dates");
    const event = await Event.create({ ...body, ownerId: req.user._id });
    await AuditLog.create({
      actorId: req.user._id,
      eventId: event._id,
      action: "event.create",
    });
    res.status(201).json({ event });
  }),
);
router.patch(
  "/:eventId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await get(req.params.eventId);
    if (!canManage(event, req.user, "edit")) throw fail(403, "Forbidden");
    const updates = schema.partial().strict().parse(req.body);
    Object.assign(event, updates);
    if (
      event.end <= event.start ||
      event.deadline > event.start ||
      event.capacity < event.registeredCount
    )
      throw fail(400, "Invalid event dates or capacity");
    await event.save();
    await AuditLog.create({
      actorId: req.user._id,
      eventId: event._id,
      action: "event.update",
      details: { fields: Object.keys(updates) },
    });
    res.json({ event });
  }),
);
router.post(
  "/:eventId/publish",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await get(req.params.eventId);
    if (!canManage(event, req.user, "publish")) throw fail(403, "Forbidden");
    event.visibility = "Published";
    await event.save();
    await AuditLog.create({
      actorId: req.user._id,
      eventId: event._id,
      action: "event.publish",
    });
    res.json({ event });
  }),
);
export { get as getEvent };
export default router;
