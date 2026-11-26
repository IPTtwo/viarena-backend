import mongoose from 'mongoose';

const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model });
const eventId = { ...ref('Event'), required: true, index: true };
const team = new Schema(
  {
    eventId,
    name: { type: String, required: true, trim: true },
    managerId: { ...ref('User'), default: null },
    handlerIds: [ref('User')],
    memberIds: [ref('User')],
  },
  { timestamps: true, optimisticConcurrency: true },
);
team.index({ eventId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
export const Team = mongoose.model('Team', team);
export const Task = mongoose.model(
  'Task',
  new Schema(
    {
      eventId,
      teamId: { ...ref('Team'), required: true },
      title: { type: String, required: true },
      description: { type: String, default: '' },
      assigneeId: { ...ref('User'), required: true },
      due: { type: Date, required: true },
      status: { type: String, enum: ['To Do', 'In Progress', 'Done'], default: 'To Do' },
    },
    { timestamps: true },
  ),
);
export const Schedule = mongoose.model(
  'Schedule',
  new Schema(
    {
      eventId,
      title: { type: String, required: true },
      startsAt: { type: Date, required: true },
      endsAt: { type: Date, required: true },
      venue: { type: String, required: true },
      description: { type: String, default: '' },
    },
    { timestamps: true },
  ),
);
const attendance = new Schema({
  eventId,
  userId: { ...ref('User'), required: true },
  verified: { type: Boolean, default: false },
  verifiedBy: ref('User'),
  verifiedAt: Date,
});
attendance.index({ eventId: 1, userId: 1 }, { unique: true });
export const Attendance = mongoose.model('Attendance', attendance);
const joinCode = new Schema({
  eventId: { ...eventId, unique: true },
  code: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
});
export const JoinCode = mongoose.model('JoinCode', joinCode);