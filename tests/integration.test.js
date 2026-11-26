import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Registration from '../src/models/Registration.js';
import Session from '../src/models/Session.js';
import AuditLog from '../src/models/AuditLog.js';
import { Team, Task, Schedule, Attendance, JoinCode } from '../src/models/Workspace.js';

test(
  'frontend/backend workflows persist with server authorization',
  { timeout: 240000 },
  async (t) => {
    const database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    let server;
    t.after(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await database.stop();
    });
    await mongoose.connect(database.getUri());
    await Promise.all(
      [
        User,
        Event,
        Registration,
        Session,
        AuditLog,
        Team,
        Task,
        Schedule,
        Attendance,
        JoinCode,
      ].map((model) => model.init()),
    );
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const client = () => {
      let cookie = '';
      return async (path, method = 'GET', body) => {
        const response = await fetch(base + path, {
          method,
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.headers.has('set-cookie'))
          cookie = response.headers.get('set-cookie').split(';')[0];
        return {
          status: response.status,
          data: await response.json(),
          headers: response.headers,
        };
      };
    };
    const organizer = client(),
      participant = client(),
      admin = client(),
      outsider = client(),
      guest = client();
    const password = 'TestingPassword123';
    let organizerId, participantId, eventId, teamId, taskId, scheduleId;
    const create = async (request, label) => {
      const account = {
        name: `${label} User`,
        email: `${label}@adnu.edu.ph`,
        studentId: `ID-${label}`,
        password,
      };
      const signup = await request('/auth/signup', 'POST', { ...account, roles: ['Admin'] });
      assert.equal(signup.status, 201);
      assert.deepEqual(signup.data.user.roles, ['Participant']);
      const login = await request('/auth/login', 'POST', { email: account.email, password });
      assert.equal(login.status, 200);
      assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
      assert.equal(login.data.user.passwordHash, undefined);
      return login.data.user.id;
    };
    await t.test(
      'signup ignores requested privileges, login restores cookie session',
      async () => {
        organizerId = await create(organizer, 'organizer');
        participantId = await create(participant, 'participant');
        const adminId = await create(admin, 'admin');
        await create(outsider, 'outsider');
        await User.findByIdAndUpdate(adminId, { roles: ['Participant', 'Admin'] });
        const grant = await admin(`/admin/users/${organizerId}/organizer-role`, 'POST', {
          grant: true,
          reason: 'Assigned campus event coordinator',
        });
        assert.equal(grant.status, 200);
        assert.equal((await organizer('/auth/me')).data.user.id, organizerId);
        assert.equal((await guest('/auth/me')).status, 401);
      },
    );
    await t.test('drafts remain private, server owns event IDs and ownership', async () => {
      const start = new Date(Date.now() + 7 * 86400000).toISOString();
      const end = new Date(Date.now() + 8 * 86400000).toISOString();
      const deadline = new Date(Date.now() + 6 * 86400000).toISOString();
      const created = await organizer('/events', 'POST', {
        title: 'Connected Event',
        category: 'Esports',
        description: 'Integration testing',
        venue: 'Campus Hall',
        start,
        end,
        deadline,
        capacity: 1,
        ownerId: participantId,
        eligibility: 'Students',
        cover: `data:image/png;base64,${'A'.repeat(80000)}`,
      });
      assert.equal(created.status, 201);
      eventId = created.data.event._id;
      assert.equal(created.data.event.ownerId, organizerId);
      assert.equal(
        (await organizer(`/events/${eventId}`, 'PATCH', { title: 'Connected Event Updated' }))
          .status,
        200,
      );
      const stored = await Event.findById(eventId);
      assert.equal(stored.eligibility, 'Students');
      assert.equal(stored.cover.length, 80022);
      assert.equal((await guest('/workspace')).data.events.length, 0);
      assert.equal((await guest(`/events/${eventId}`)).status, 404);
      assert.equal((await organizer(`/events/${eventId}`)).status, 200);
      assert.equal((await participant(`/events/${eventId}/publish`, 'POST')).status, 403);
      assert.equal((await organizer(`/events/${eventId}/publish`, 'POST')).status, 200);
      assert.equal((await guest('/workspace')).data.events.length, 1);
    });
    await t.test('atomic registration capacity and duplicate prevention', async () => {
      const results = await Promise.all([
        participant(`/events/${eventId}/registrations`, 'POST'),
        outsider(`/events/${eventId}/registrations`, 'POST'),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      // Ensure the named participant is the registered account for the remaining workflow.
      if (results[1].status === 201) {
        assert.equal(
          (await outsider(`/events/${eventId}/registrations/me`, 'DELETE')).status,
          200,
        );
        assert.equal(
          (await participant(`/events/${eventId}/registrations`, 'POST')).status,
          201,
        );
      }
      assert.equal((await participant(`/events/${eventId}/registrations`, 'POST')).status, 409);
      assert.equal((await Event.findById(eventId)).registeredCount, 1);
      assert.equal(
        (await participant('/workspace')).data.registrations.filter(
          (r) => r.status === 'Registered',
        ).length,
        1,
      );
      assert.equal((await guest('/workspace')).data.registrations.length, 0);
      assert.equal((await outsider(`/events/${eventId}/registrations`)).status, 403);
    });
    const action = (request, name, body) => request(`/workspace/actions/${name}`, 'POST', body);
    await t.test('team membership, roles, tasks and scoped access persist', async () => {
      assert.equal(
        (await action(participant, 'createTeam', { eventId, name: 'Forbidden' })).status,
        403,
      );
      const created = await action(organizer, 'createTeam', { eventId, name: 'Team Alpha' });
      assert.equal(created.status, 200);
      teamId = created.data.resource._id;
      assert.equal(
        (
          await action(organizer, 'placeMember', {
            teamId,
            userId: participantId,
            remove: false,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await action(organizer, 'assignTeamRole', {
            teamId,
            userId: participantId,
            role: 'Manager',
            remove: false,
          })
        ).status,
        200,
      );
      const task = await action(participant, 'saveTask', {
        teamId,
        fields: {
          title: 'Prepare equipment',
          assigneeId: participantId,
          due: new Date().toISOString(),
        },
        taskId: null,
      });
      assert.equal(task.status, 200);
      taskId = task.data.resource._id;
      assert.equal(
        (await action(outsider, 'updateTaskStatus', { taskId, status: 'Done' })).status,
        403,
      );
      assert.equal(
        (await action(participant, 'updateTaskStatus', { taskId, status: 'Done' })).status,
        200,
      );
      const snapshot = (await participant('/workspace')).data;
      assert.equal(snapshot.teams[0].managerId, participantId);
      assert.equal(snapshot.tasks[0].status, 'Done');
      assert.equal((await outsider('/workspace')).data.teams.length, 0);
    });
    await t.test(
      'schedules, streams, verified participation and join codes persist',
      async () => {
        const schedule = await action(organizer, 'saveSchedule', {
          eventId,
          scheduleId: null,
          fields: {
            title: 'Opening',
            startsAt: new Date(Date.now() + 100000).toISOString(),
            endsAt: new Date(Date.now() + 200000).toISOString(),
            venue: 'Campus Hall',
          },
        });
        assert.equal(schedule.status, 200);
        scheduleId = schedule.data.resource._id;
        assert.equal(
          (
            await action(organizer, 'saveStream', {
              eventId,
              fields: {
                url: 'https://www.youtube.com/watch?v=abcd',
                replayUrl: '',
                provider: 'YouTube',
                status: 'Scheduled',
                scheduledAt: '',
              },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await action(organizer, 'confirmParticipation', {
              eventId,
              userId: participantId,
              verified: true,
            })
          ).status,
          200,
        );
        const code = await action(organizer, 'generateJoinCode', { eventId });
        assert.equal(code.status, 200);
        assert.equal(
          (await guest(`/workspace/join/${code.data.resource.code}`)).data.eventId,
          eventId,
        );
        assert.equal((await guest('/workspace')).data.joinCodes.length, 0);
        assert.equal((await action(organizer, 'disableJoinCode', { eventId })).status, 200);
        assert.equal((await guest(`/workspace/join/${code.data.resource.code}`)).status, 404);
        const snapshot = (await participant('/workspace')).data;
        assert.equal(snapshot.schedules.length, 1);
        assert.equal(snapshot.events[0].stream.provider, 'YouTube');
        assert.equal(snapshot.attendance[0].verified, true);
        assert.equal(
          (await action(organizer, 'removeSchedule', { eventId, scheduleId })).status,
          200,
        );
      },
    );
    await t.test(
      'staff permissions are enforced on the server and revoked immediately',
      async () => {
        assert.equal(
          (
            await action(organizer, 'setCoOrganizer', {
              eventId,
              userId: participantId,
              permissions: ['manage_event_schedule'],
              remove: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await action(participant, 'saveStream', {
              eventId,
              fields: {
                url: '',
                replayUrl: '',
                provider: 'Other',
                status: 'Scheduled',
                scheduledAt: '',
              },
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await action(participant, 'saveSchedule', {
              eventId,
              scheduleId: null,
              fields: {
                title: 'Staff session',
                startsAt: new Date().toISOString(),
                endsAt: new Date(Date.now() + 10000).toISOString(),
                venue: 'Hall',
              },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await action(organizer, 'setCoOrganizer', {
              eventId,
              userId: participantId,
              permissions: [],
              remove: true,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await action(participant, 'saveSchedule', {
              eventId,
              scheduleId: null,
              fields: {
                title: 'Staff session',
                startsAt: new Date().toISOString(),
                endsAt: new Date(Date.now() + 10000).toISOString(),
                venue: 'Hall',
              },
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      'profile edits reject privilege injection and admin history is recorded',
      async () => {
        assert.equal(
          (await participant('/users/me', 'PATCH', { roles: ['Admin'] })).status,
          400,
        );
        const updated = await participant('/users/me', 'PATCH', {
          name: 'Updated Participant',
          studentId: 'UPDATED-001',
          bio: 'Connected profile',
        });
        assert.equal(updated.status, 200);
        assert.equal((await participant('/auth/me')).data.user.name, 'Updated Participant');
        assert.equal(
          (
            await admin(`/admin/users/${organizerId}/organizer-role`, 'POST', {
              grant: false,
              reason: 'Testing owner revocation guard',
            })
          ).status,
          409,
        );
        assert.ok(
          (await admin('/workspace')).data.logs.some(
            (entry) => entry.action === 'role.organizer.grant',
          ),
        );
        assert.equal((await participant('/admin/users')).status, 403);
        assert.equal(
          (await action(admin, 'reassignEventOwner', { eventId, userId: participantId }))
            .status,
          409,
        );
      },
    );
    await t.test(
      'unpublish, cancellation, logout and expired sessions use server state',
      async () => {
        assert.equal((await organizer(`/events/${eventId}/unpublish`, 'POST')).status, 200);
        assert.equal((await guest('/workspace')).data.events.length, 0);
        assert.equal(
          (await participant(`/events/${eventId}/registrations/me`, 'DELETE')).status,
          200,
        );
        assert.equal((await Event.findById(eventId)).registeredCount, 0);
        assert.equal(await Attendance.countDocuments({ eventId, userId: participantId }), 0);
        assert.equal(await Task.countDocuments({ eventId, assigneeId: participantId }), 0);
        assert.equal((await Team.findById(teamId)).memberIds.length, 0);
        assert.equal((await participant('/auth/logout', 'POST')).status, 200);
        assert.equal((await participant('/auth/me')).status, 401);
        assert.equal((await participant('/workspace')).data.user, null);
        await Session.deleteMany({});
        assert.equal((await organizer('/workspace')).data.user, null);
      },
    );
  },
);
