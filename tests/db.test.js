import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';

test('database connection is shared by concurrent requests and retried after failure', async (t) => {
  const previous = process.env.MONGODB_URI;
  process.env.MONGODB_URI = 'mongodb://unused-in-mocked-test/viarena';
  let resolveConnection;
  const connect = t.mock.method(mongoose, 'connect', () => new Promise((resolve) => {
    resolveConnection = resolve;
  }));
  t.after(() => {
    if (previous === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previous;
  });
  const first = connectDB();
  const second = connectDB();
  assert.equal(connect.mock.callCount(), 1);
  resolveConnection(mongoose);
  assert.equal(await first, mongoose);
  assert.equal(await second, mongoose);
  connect.mock.mockImplementation(() => Promise.reject(new Error('Connection failed')));
  await assert.rejects(connectDB(), /Connection failed/);
  connect.mock.mockImplementation(() => Promise.resolve(mongoose));
  assert.equal(await connectDB(), mongoose);
  assert.equal(connect.mock.callCount(), 3);
});
