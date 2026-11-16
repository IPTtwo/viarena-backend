# ViArena Backend — MERN Phase 2

Separate Express + MongoDB API for the [ViArena frontend](https://github.com/IPTtwo/ViArena). Implements routes in `API_CONTRACTS.md`. **This is a development starter, not a production-certified deployment.** The existing React fixture store must still be migrated to fetch these endpoints.

## Quick start (VS Code terminal)

1. Install Node.js 20+ and MongoDB Atlas or MongoDB local **replica set** (transactions are required for registrations).
2. `npm install`
3. Copy `.env.example` to `.env` and set `MONGODB_URI` and `SESSION_SECRET`.
4. `npm run dev`
5. Check `http://localhost:5000/api/health`.
6. Run `npm test` and `npm run check`.

For local MongoDB, configure a single-node replica set (`mongod --replSet rs0 ...` then `rs.initiate()` in mongosh), or use MongoDB Atlas. A standalone MongoDB server will fail transactional registration operations.

## Auth and API behavior

Signup accepts `name`, `email` (default `@adnu.edu.ph`), `studentId`, `password` (8+ chars including uppercase, lowercase and number). Login sets an HTTP-only cookie. Fetch with `credentials: 'include'`. Production must use HTTPS, a strong secret, and a trusted deployment topology. For cross-site frontend/backend hosting, configure a same-site reverse proxy or review cookie and CSRF protections before deployment. Password reset **does not send emails** yet: in development it logs a reset link; production needs a mail delivery provider. No default admin accounts are seeded: provision the first Admin via a secured operational process, not public signup.

The `/api/events` GET endpoint only returns Published events. Event create/publish is Organizer-only; admin role-management is Admin-only. Registrations use MongoDB transactions. Event IDs are MongoDB ObjectIds, not the frontend's `evt-...` fixture IDs.

## Collaboration

See `tickets/README.md` for exact file ownership, branch names, dependency order, and PR steps. Do not upload all code as one developer's ticket PR: use the ZIP as the local reference implementation and copy only assigned files into each ticket branch. All developers branch from the latest shared backend `main`, after its bootstrap commit. One PR per ticket.

## Remaining production/integration tasks

- Integrate the React store with the API and adapt data shapes/IDs.
- Implement SMTP/email delivery for password reset and frontend recovery screens.
- Add CSRF defenses for cookie-authenticated mutation endpoints, production cookie configuration, structured logging, monitoring and security review.
- Add MongoDB integration tests against a replica set, concurrency tests, permission tests, and end-to-end UI tests.
- Establish a secure admin bootstrap procedure and configure deployment secrets.
