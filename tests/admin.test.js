import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/User.js';

test('administrator CLI creates a hashed account and refuses overwrites', { timeout: 120000 }, async (t) => {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  t.after(async () => { await mongoose.disconnect(); await database.stop(); });
  const uri = database.getUri();
  await mongoose.connect(uri);
  const run = promisify(execFile);
  const script = fileURLToPath(new URL('../scripts/create-admin.js', import.meta.url));
  const args = [script, 'admin@adnu.edu.ph', 'ADMIN-TEST', 'Test Administrator'];
  const password = 'TestingAdmin123';
  const env = { ...process.env, MONGODB_URI: uri, ADMIN_PASSWORD: password, SCHOOL_EMAIL_DOMAIN: 'adnu.edu.ph' };
  await run(process.execPath, args, { env });
  const account = await User.findOne({ email: 'admin@adnu.edu.ph' }).select('+passwordHash');
  assert.deepEqual([...account.roles], ['Participant', 'Organizer', 'Admin']);
  assert.notEqual(account.passwordHash, password);
  assert.equal(await bcrypt.compare(password, account.passwordHash), true);
  await assert.rejects(run(process.execPath, args, { env }), (error) => {
    assert.match(error.stderr, /already exists/);
    return true;
  });
  assert.equal(await User.countDocuments(), 1);
  await assert.rejects(run(process.execPath, [script, 'other@adnu.edu.ph', 'OTHER-ID', 'Other Admin'], {
    env: { ...env, ADMIN_PASSWORD: 'weak' },
  }));
  assert.equal(await User.countDocuments(), 1);
});
