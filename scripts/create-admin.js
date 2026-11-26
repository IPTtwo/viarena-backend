import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import { signupSchema } from '../src/validators/auth.js';

try {
  const [email, studentId, name] = process.argv.slice(2);
  if (!email || !studentId || !name || !process.env.ADMIN_PASSWORD)
    throw new Error('Set ADMIN_PASSWORD, then run: npm run create-admin -- email studentId "Full Name"');
  const fields = signupSchema.parse({ email, studentId, name, password: process.env.ADMIN_PASSWORD });
  const domain = process.env.SCHOOL_EMAIL_DOMAIN || 'adnu.edu.ph';
  if (!fields.email.endsWith(`@${domain}`)) throw new Error(`Use an @${domain} email address.`);
  await connectDB();
  await User.init();
  if (await User.exists({ $or: [{ email: fields.email }, { studentId: fields.studentId }] }))
    throw new Error('Email or student ID already exists; no account was changed.');
  await User.create({
    name: fields.name, email: fields.email, studentId: fields.studentId,
    passwordHash: await bcrypt.hash(fields.password, 12),
    roles: ['Participant', 'Organizer', 'Admin'],
  });
  console.log('Administrator created. Sign in through the frontend.');
} catch (error) {
  console.error(error.code === 11000 ? 'Email or student ID already exists.' : error.name === 'ZodError' ? 'Invalid account fields. Use a school email, a 3–40 character student ID, and an 8–128 character password with uppercase, lowercase and a digit.' : error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
