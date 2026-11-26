import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import Event from '../models/Event.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Registration from '../models/Registration.js';
import { Team, Task, Schedule, Attendance, JoinCode } from '../models/Workspace.js';
import { optionalAuth, requireAuth, canManage } from '../middleware/auth.js';
import { asyncHandler, fail } from '../utils/http.js';

const router = Router();
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const text = z.string().trim().min(1).max(200);
const manager = (event, user) => canManage(event, user, 'manage_teams');
const owner = (event, user) =>
  user.roles.includes('Admin') || String(event.ownerId) === String(user._id);
const permissions = z.enum([
  'manage_event',
  'manage_registrations',
  'manage_teams',
  'manage_event_schedule',
  'manage_stream',
  'manage_participation',
]);
const scheduleFields = z
  .object({
    title: text,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    venue: text,
    description: z.string().max(10000).default(''),
  })
  .refine((v) => v.endsAt > v.startsAt, 'End time must be after start time');
const taskFields = z.object({
  title: text,
  description: z.string().max(10000).default(''),
  assigneeId: id,
  due: z.coerce.date(),
});
const secureUrl = z
  .string()
  .max(1500000)
  .refine((value) => !value || /^https:\/\//i.test(value), 'Use an HTTPS URL');
const streamFields = z.object({
  url: secureUrl,
  replayUrl: secureUrl,
  provider: z.enum(['YouTube', 'Twitch', 'Facebook', 'Other']),
  status: z.enum(['Scheduled', 'Live', 'Ended']),
  scheduledAt: z.union([z.literal(''), z.coerce.date()]),
});
const getEvent = async (eventId) => {
  const event = await Event.findById(id.parse(eventId));
  if (!event) throw fail(404, 'Event not found');
  return event;
};
const getTeam = async (teamId) => {
  const team = await Team.findById(id.parse(teamId));
  if (!team) throw fail(404, 'Team not found');
  return team;
};
const authorize = (allowed) => {
  if (!allowed) throw fail(403, 'Forbidden');
};

// One permission-filtered snapshot keeps the existing frontend store contract intact.
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const admin = user?.roles.includes('Admin');
    const staffFilter = user
      ? { $or: [{ ownerId: user._id }, { 'coOrganizers.userId': user._id }] }
      : null;
    const managed = user ? await Event.find(admin ? {} : staffFilter).lean() : [];
    const managedIds = managed.map((e) => e._id);
    const events = await Event.find(
      admin
        ? {}
        : {
            $or: [{ visibility: 'Published' }, ...(user ? [{ _id: { $in: managedIds } }] : [])],
          },
    )
      .sort({ start: 1 })
      .lean();
    const eventIds = events.map((e) => e._id);
    const teamEvents = managed.filter((e) => manager(e, user)).map((e) => e._id);
    const rosterEvents = managed
      .filter(
        (e) =>
          canManage(e, user, 'viewRegistrations') ||
          canManage(e, user, 'manage_participation') ||
          manager(e, user),
      )
      .map((e) => e._id);
    const teams = user
      ? await Team.find(
          admin ? {} : { $or: [{ eventId: { $in: teamEvents } }, { memberIds: user._id }] },
        ).lean()
      : [];
    for (const team of teams) {
      if (String(team.managerId) === String(user?._id)) rosterEvents.push(team.eventId);
    }
    const registrations = user
      ? await Registration.find(
          admin ? {} : { $or: [{ userId: user._id }, { eventId: { $in: rosterEvents } }] },
        ).lean()
      : [];
    const participantIds = registrations.map((r) => r.userId);
    const teamMemberIds = teams.flatMap((t) => t.memberIds);
    const canFindStaff = admin || managed.some((e) => owner(e, user));
    const users = !user
      ? []
      : await User.find(
          canFindStaff ? {} : { _id: { $in: [user._id, ...participantIds, ...teamMemberIds] } },
        )
          .select(admin ? '-resetHash -resetExpires' : '_id name roles studentId')
          .lean();
    if (user && !admin) {
      for (const member of users) {
        // Only event staff may see roster student IDs; team peers receive names and roles.
        if (
          String(member._id) !== String(user._id) &&
          (!rosterEvents.length ||
            !participantIds.some((value) => String(value) === String(member._id)))
        )
          delete member.studentId;
      }
    }
    const [tasks, schedules, attendance, joinCodes, logs] = await Promise.all([
      Task.find({ teamId: { $in: teams.map((t) => t._id) } }).lean(),
      Schedule.find({ eventId: { $in: eventIds } }).lean(),
      user
        ? Attendance.find(
            admin ? {} : { $or: [{ userId: user._id }, { eventId: { $in: rosterEvents } }] },
          ).lean()
        : [],
      JoinCode.find({ eventId: { $in: managedIds } }).lean(),
      admin
        ? AuditLog.find().sort({ createdAt: -1 }).limit(500).populate('actorId', 'name').lean()
        : [],
    ]);
    const safeEvents = events.map((event) => {
      if (!managedIds.some((value) => String(value) === String(event._id)))
        delete event.coOrganizers;
      return event;
    });
    res.json({
      user: user || null,
      users,
      events: safeEvents,
      registrations,
      teams,
      tasks,
      schedules,
      attendance,
      joinCodes,
      logs,
    });
  }),
);

router.get(
  '/join/:code',
  asyncHandler(async (req, res) => {
    const code = z
      .string()
      .regex(/^[A-F\d]{8}$/i)
      .parse(req.params.code)
      .toUpperCase();
    const entry = await JoinCode.findOne({ code, enabled: true });
    const event =
      entry && (await Event.findOne({ _id: entry.eventId, visibility: 'Published' }));
    if (!event) throw fail(404, 'This event code is invalid or unavailable');
    res.json({ eventId: event._id });
  }),
);

router.post(
  '/actions/:action',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const body = req.body;
    let event, resource;
    switch (req.params.action) {
      case 'createTeam': {
        const value = z.object({ eventId: id, name: text }).strict().parse(body);
        event = await getEvent(value.eventId);
        authorize(manager(event, user));
        resource = await Team.create(value);
        break;
      }
      case 'placeMember': {
        const { teamId, userId, remove } = z
          .object({ teamId: id, userId: id, remove: z.boolean() })
          .strict()
          .parse(body);
        const team = await getTeam(teamId);
        event = await getEvent(team.eventId.toString());
        authorize(manager(event, user) || String(team.managerId) === String(user._id));
        if (
          !remove &&
          !(await Registration.exists({ eventId: event._id, userId, status: 'Registered' }))
        )
          throw fail(409, 'Only registered participants can join an event team');
        if (remove) {
          team.memberIds = team.memberIds.filter((v) => String(v) !== userId);
          team.handlerIds = team.handlerIds.filter((v) => String(v) !== userId);
          if (String(team.managerId) === userId) team.managerId = null;
        } else if (!team.memberIds.some((v) => String(v) === userId))
          team.memberIds.push(userId);
        resource = await team.save();
        break;
      }
      case 'assignTeamRole': {
        const { teamId, userId, role, remove } = z
          .object({
            teamId: id,
            userId: id,
            role: z.enum(['Manager', 'Handler']),
            remove: z.boolean(),
          })
          .strict()
          .parse(body);
        const team = await getTeam(teamId);
        event = await getEvent(team.eventId.toString());
        authorize(manager(event, user));
        if (!team.memberIds.some((v) => String(v) === userId))
          throw fail(409, 'Assign the participant to the team first');
        if (role === 'Manager')
          team.managerId = remove
            ? String(team.managerId) === userId
              ? null
              : team.managerId
            : userId;
        else
          team.handlerIds = remove
            ? team.handlerIds.filter((v) => String(v) !== userId)
            : [...new Set([...team.handlerIds.map(String), userId])];
        resource = await team.save();
        break;
      }
      case 'saveTask': {
        const { teamId, fields, taskId } = z
          .object({ teamId: id, fields: taskFields, taskId: id.nullable() })
          .strict()
          .parse(body);
        const team = await getTeam(teamId);
        event = await getEvent(team.eventId.toString());
        authorize(manager(event, user) || String(team.managerId) === String(user._id));
        if (!team.memberIds.some((v) => String(v) === fields.assigneeId))
          throw fail(409, 'Choose a member of this team');
        resource = taskId
          ? await Task.findOneAndUpdate(
              { _id: taskId, teamId },
              { $set: fields },
              { new: true, runValidators: true },
            )
          : await Task.create({ ...fields, eventId: event._id, teamId });
        if (!resource) throw fail(404, 'Task not found');
        break;
      }
      case 'updateTaskStatus': {
        const { taskId, status } = z
          .object({ taskId: id, status: z.enum(['To Do', 'In Progress', 'Done']) })
          .strict()
          .parse(body);
        const task = await Task.findById(taskId);
        if (!task) throw fail(404, 'Task not found');
        const team = await getTeam(task.teamId.toString());
        event = await getEvent(team.eventId.toString());
        authorize(
          manager(event, user) ||
            String(team.managerId) === String(user._id) ||
            (team.memberIds.some((v) => String(v) === String(user._id)) &&
              String(task.assigneeId) === String(user._id)),
        );
        task.status = status;
        resource = await task.save();
        break;
      }
      case 'saveSchedule': {
        const { eventId, fields, scheduleId } = z
          .object({ eventId: id, fields: scheduleFields, scheduleId: id.nullable() })
          .strict()
          .parse(body);
        event = await getEvent(eventId);
        authorize(canManage(event, user, 'manage_event_schedule'));
        resource = scheduleId
          ? await Schedule.findOneAndUpdate(
              { _id: scheduleId, eventId },
              { $set: fields },
              { new: true, runValidators: true },
            )
          : await Schedule.create({ ...fields, eventId });
        if (!resource) throw fail(404, 'Schedule item not found');
        break;
      }
      case 'removeSchedule': {
        const { eventId, scheduleId } = z
          .object({ eventId: id, scheduleId: id })
          .strict()
          .parse(body);
        event = await getEvent(eventId);
        authorize(canManage(event, user, 'manage_event_schedule'));
        resource = await Schedule.findOneAndDelete({ _id: scheduleId, eventId });
        if (!resource) throw fail(404, 'Schedule item not found');
        break;
      }
      case 'saveStream': {
        const { eventId, fields } = z
          .object({ eventId: id, fields: streamFields })
          .strict()
          .parse(body);
        event = await getEvent(eventId);
        authorize(canManage(event, user, 'manage_stream'));
        event.stream = fields;
        resource = await event.save();
        break;
      }
      case 'confirmParticipation': {
        const { eventId, userId, verified } = z
          .object({ eventId: id, userId: id, verified: z.boolean() })
          .strict()
          .parse(body);
        event = await getEvent(eventId);
        authorize(canManage(event, user, 'manage_participation'));
        if (!(await Registration.exists({ eventId, userId, status: 'Registered' })))
          throw fail(409, 'Only registered participants can be verified');
        resource = await Attendance.findOneAndUpdate(
          { eventId, userId },
          { $set: { verified, verifiedBy: user._id, verifiedAt: new Date() } },
          { new: true, upsert: true, runValidators: true },
        );
        break;
      }
      case 'setCoOrganizer': {
        const {
          eventId,
          userId,
          permissions: grants,
          remove,
        } = z
          .object({
            eventId: id,
            userId: id,
            permissions: z.array(permissions).max(6),
            remove: z.boolean(),
          })
          .strict()
          .parse(body);
        event = await getEvent(eventId);
        authorize(owner(event, user));
        if (String(event.ownerId) === userId)
          throw fail(409, 'The owner already manages this event');
        if (!(await User.exists({ _id: userId }))) throw fail(404, 'User not found');
        event.coOrganizers = event.coOrganizers.filter((v) => String(v.userId) !== userId);
        if (!remove) event.coOrganizers.push({ userId, permissions: [...new Set(grants)] });
        resource = await event.save();
        break;
      }
      case 'reassignEventOwner': {
        const { eventId, userId } = z.object({ eventId: id, userId: id }).strict().parse(body);
        authorize(user.roles.includes('Admin'));
        event = await getEvent(eventId);
        if (!(await User.exists({ _id: userId, roles: 'Organizer' })))
          throw fail(409, 'New owner must be an active Organizer');
        event.ownerId = userId;
        event.coOrganizers = event.coOrganizers.filter((v) => String(v.userId) !== userId);
        resource = await event.save();
        break;
      }
      case 'generateJoinCode':
      case 'disableJoinCode': {
        const { eventId } = z.object({ eventId: id }).strict().parse(body);
        event = await getEvent(eventId);
        authorize(manager(event, user));
        if (req.params.action === 'generateJoinCode')
          resource = await JoinCode.findOneAndUpdate(
            { eventId },
            {
              $set: {
                code: crypto.randomBytes(4).toString('hex').toUpperCase(),
                enabled: true,
              },
            },
            { upsert: true, new: true },
          );
        else
          resource = await JoinCode.findOneAndUpdate(
            { eventId },
            { $set: { enabled: false } },
            { new: true },
          );
        break;
      }
      default:
        throw fail(404, 'Unknown workspace action');
    }
    await AuditLog.create({
      actorId: user._id,
      eventId: event._id,
      action: req.params.action,
      details: { resourceId: resource?._id },
    });
    res.json({ resource });
  }),
);

export default router;