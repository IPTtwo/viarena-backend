import test from 'node:test';
import assert from 'node:assert/strict';
import { canManage } from '../src/middleware/auth.js';

test('frontend staff permissions authorize matching routes without granting unrelated access', () => {
  const user = { _id: 'staff', roles: ['Participant'] };
  const event = {
    ownerId: 'owner',
    coOrganizers: [{ userId: 'staff', permissions: ['manage_event'] }],
  };
  assert.equal(canManage(event, user, 'edit'), true);
  assert.equal(canManage(event, user, 'publish'), true);
  assert.equal(canManage(event, user, 'manageRegistrations'), false);
  event.coOrganizers[0].permissions = ['manage_registrations'];
  assert.equal(canManage(event, user, 'viewRegistrations'), true);
  assert.equal(canManage(event, user, 'manageRegistrations'), true);
  assert.equal(canManage(event, user, 'edit'), false);
  event.coOrganizers[0].permissions = ['viewRegistrations'];
  assert.equal(canManage(event, user, 'viewRegistrations'), true);
  assert.equal(canManage(event, user, 'manageRegistrations'), false);
  assert.equal(canManage(event, null), false);
});
