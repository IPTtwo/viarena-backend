import { Router } from "express";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import AuditLog from "../models/AuditLog.js";
import { requireAuth, canManage } from "../middleware/auth.js";
import { asyncHandler, fail, validId } from "../utils/http.js";

const router = Router();
const eventFor = async (id) => {
  if (!validId(id)) throw fail(400, "Invalid event ID");
  const e = await Event.findById(id);
  if (!e) throw fail(404, "Event not found");
  return e;
};


router.post(
  "/events/:eventId/registrations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    let registration;
    try {
      await session.withTransaction(async () => {
        const event = await eventFor(req.params.eventId);
        if (
          event.visibility !== "Published" ||
          event.deadline < new Date() ||
          event.start < new Date()
        )
          throw fail(409, "Registration closed");
        const existing = await Registration.findOne({
          eventId: event._id,
          userId: req.user._id,
        }).session(session);
        if (existing?.status === "Registered")
          throw fail(409, "Already registered");
        const update = await Event.updateOne(
          { _id: event._id, registeredCount: { $lt: event.capacity } },
          { $inc: { registeredCount: 1 } },
          { session },
        );
        if (update.modifiedCount !== 1) throw fail(409, "Event full");
        if (existing) {
          existing.status = "Registered";
          await existing.save({ session });
          registration = existing;
        } else {
          [registration] = await Registration.create(
            [{ eventId: event._id, userId: req.user._id }],
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }
    res.status(201).json({ registration });
  }),
);
router.delete(
  "/events/:eventId/registrations/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const event = await eventFor(req.params.eventId);
        if (event.start <= new Date()) throw fail(409, "Event already started");
        const r = await Registration.findOneAndUpdate(
          { eventId: event._id, userId: req.user._id, status: "Registered" },
          { $set: { status: "Cancelled" } },
          { new: true, session },
        );
        if (!r) throw fail(404, "Active registration not found");
        await Event.updateOne(
          { _id: event._id },
          { $inc: { registeredCount: -1 } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    res.json({ message: "Registration cancelled" });
  }),
);
router.get(
  "/me/registrations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const registrations = await Registration.find({
      userId: req.user._id,
      status: "Registered",
    })
      .populate("eventId", "title category venue start end visibility")
      .sort({ createdAt: -1 });
    res.json({ registrations });
  }),
);
router.get(
  "/events/:eventId/registrations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await eventFor(req.params.eventId);
    if (!canManage(event, req.user, "viewRegistrations"))
      throw fail(403, "Forbidden");
    const registrations = await Registration.find({
      eventId: event._id,
      status: "Registered",
    })
      .populate("userId", "name studentId")
      .select("userId status createdAt");
    res.json({ registrations });
  }),
);
router.delete(
  "/events/:eventId/registrations/:registrationId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const event = await eventFor(req.params.eventId);
    if (!canManage(event, req.user, "manageRegistrations"))
      throw fail(403, "Forbidden");
    if (!validId(req.params.registrationId))
      throw fail(400, "Invalid registration ID");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const r = await Registration.findOneAndUpdate(
          {
            _id: req.params.registrationId,
            eventId: event._id,
            status: "Registered",
          },
          { $set: { status: "Cancelled" } },
          { new: true, session },
        );
        if (!r) throw fail(404, "Active registration not found");
        await Event.updateOne(
          { _id: event._id },
          { $inc: { registeredCount: -1 } },
          { session },
        );
        await AuditLog.create(
          [
            {
              actorId: req.user._id,
              eventId: event._id,
              targetUserId: r.userId,
              action: "registration.remove",
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    res.json({ message: "Registration removed" });
  }),
);

export default router;
