import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import User from '../src/models/User.js';

const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(database.getUri());
await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
await User.create({
  name: 'Browser Organizer',
  email: 'organizer@adnu.edu.ph',
  studentId: 'BROWSER-ORG',
  passwordHash: await bcrypt.hash('BrowserPassword123', 12),
  roles: ['Participant', 'Organizer', 'Admin'],
});
const server = app.listen(5001, '127.0.0.1', () =>
  console.log('Disposable browser-test API ready'),
);
async function close() {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await database.stop();
  process.exit(0);
}
process.on('SIGINT', close);
process.on('SIGTERM', close);

