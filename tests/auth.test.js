import test from 'node:test';
import assert from 'node:assert/strict';
import { canManage, requireRole } from '../src/middleware/auth.js';
import { profileSchema } from '../src/validators/user.js';

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

test('Admin satisfies Organizer checks while Participants cannot manage owned events', () => {
  let error;
  requireRole('Organizer')({ user: { roles: ['Admin'] } }, {}, (value) => { error = value; });
  assert.equal(error, undefined);
  requireRole('Organizer')({ user: { roles: ['Participant'] } }, {}, (value) => { error = value; });
  assert.equal(error.status, 403);
  const event = { ownerId: 'owner', coOrganizers: [] };
  assert.equal(canManage(event, { _id: 'owner', roles: ['Participant'] }), false);
  assert.equal(canManage(event, { _id: 'owner', roles: ['Organizer'] }), true);
  assert.equal(canManage({ ownerId: 'owner' }, { _id: 'other', roles: ['Participant'] }), false);
});

test('team and participation staff can read rosters without canceling registrations', () => {
  const user = { _id: 'staff', roles: ['Participant'] };
  for (const permission of ['manage_teams', 'manage_participation']) {
    const event = { ownerId: 'owner', coOrganizers: [{ userId: 'staff', permissions: [permission] }] };
    assert.equal(canManage(event, user, 'viewRegistrations'), true);
    assert.equal(canManage(event, user, 'manageRegistrations'), false);
    assert.equal(canManage(event, user, 'edit'), false);
  }
});

test('profile student IDs match signup limits and reject privilege fields', () => {
  assert.equal(profileSchema.parse({ studentId: '  ID-001  ' }).studentId, 'ID-001');
  assert.equal(profileSchema.safeParse({ studentId: 'AB' }).success, false);
  assert.equal(profileSchema.safeParse({ studentId: 'A'.repeat(41) }).success, false);
  assert.equal(profileSchema.safeParse({ roles: ['Admin'] }).success, false);
});
