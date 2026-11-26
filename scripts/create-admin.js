import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import { signupSchema } from '../src/validators/auth.js';

try {
  const [email, studentId, name] = process.argv.slice(2);
  const body = signupSchema.parse({
    email,
    studentId,
    name,
    password: process.env.ADMIN_PASSWORD,
  });
  const domain = process.env.SCHOOL_EMAIL_DOMAIN || 'adnu.edu.ph';
  if (!body.email.endsWith(`@${domain}`)) throw new Error('School email required');
  await connectDB();
  if (await User.exists({ $or: [{ email: body.email }, { studentId: body.studentId }] }))
    throw new Error('Account already exists; no changes made');
  await User.create({
    name: body.name,
    email: body.email,
    studentId: body.studentId,
    passwordHash: await bcrypt.hash(body.password, 12),
    roles: ['Participant', 'Organizer', 'Admin'],
  });
  console.log('Administrator created. Sign in through the frontend.');
} catch (error) {
  console.error(
    error.name === 'ZodError'
      ? 'Provide email, student ID, name, and a strong ADMIN_PASSWORD environment variable.'
      : error.message,
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
