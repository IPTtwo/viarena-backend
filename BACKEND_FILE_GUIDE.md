# Backend File Guide

This document explains what each important backend file does and where developers should add changes.

## Request flow

```text
Frontend request
      ↓
src/server.js
      ↓
src/app.js
      ↓
middleware
      ↓
routes
      ↓
controllers / services
      ↓
models
      ↓
MongoDB
```

## Application startup

### `src/server.js`

This is the backend entry point. It:

1. Loads environment variables.
2. Connects to MongoDB.
3. Starts the Express server on `PORT` or port `5000`.

Start this file with `npm start` or `npm run dev`.

### `src/app.js`

This creates and configures the Express application. It sets up:

- Helmet security headers.
- CORS for the frontend origin.
- JSON request parsing.
- Cookies.
- Authentication rate limiting.
- The `/api/health` endpoint.
- Route groups such as `/api/auth` and `/api/events`.
- Shared 404 and error responses.

Keep server startup in `server.js`; keep reusable Express configuration in `app.js` so tests can import the app without starting a real server.

### `src/config/db.js`

Contains the MongoDB connection helper. The connection string comes from `MONGODB_URI`.

## Middleware

### `src/middleware/auth.js`

This file protects private endpoints.

- `hashToken()` hashes session tokens before they are stored or searched.
- `requireAuth` reads the HTTP-only session cookie, finds the matching active session, loads the user, and stores it on `req.user`.
- `requireRole('Admin')` restricts an endpoint to a role.
- `canManage()` checks whether a user can manage an event as an admin, owner, or permitted co-organizer.

Routes should use middleware for authorization instead of trusting role or owner values sent by the frontend.

Example:

```js
router.post('/', requireAuth, requireRole('Organizer'), createEvent);
```

## Routes

Routes define URLs and connect them to middleware and handlers. They should not trust browser-supplied permissions.

### `src/routes/auth.js`

Defines signup, login, logout, current-user, forgot-password, and reset-password endpoints.

### `src/routes/users.js`

Defines authenticated profile updates through `PATCH /api/users/me`.

### `src/routes/events.js`

Defines public event listing/detail endpoints and organizer event creation, editing, and publishing.

### `src/routes/registrations.js`

Defines participant registration, cancellation, personal registrations, and authorized staff registration management.

Registration capacity changes use MongoDB transactions.

### `src/routes/admin.js`

Defines admin-only user management, organizer role changes, and role-history endpoints.

## Controllers

Controllers translate an HTTP request into an application operation and send the HTTP response.

- `src/controllers/auth.js` handles authentication request/response behavior.
- `src/controllers/users.js` handles profile request/response behavior.

When adding a new controller, validate input before calling a service and return a consistent response shape.

## Services

Services contain reusable business operations that should not depend on Express response objects.

- `src/services/auth.js` creates users, authenticates passwords, creates/removes sessions, and manages password resets.
- `src/services/user.js` updates profile fields.

Business rules belong here when they may be reused by multiple routes or controllers.

## Validators

Validators contain Zod schemas for request bodies.

- `src/validators/auth.js` validates email, password, signup, login, and password recovery data.
- `src/validators/user.js` validates editable profile fields.

Reject unknown fields with `.strict()` when the endpoint must not accept extra data.

## Models

Models define MongoDB documents and indexes through Mongoose.

- `src/models/User.js`: accounts, roles, profile data, and password-reset fields.
- `src/models/Session.js`: hashed session tokens and expiration.
- `src/models/Event.js`: event details, ownership, capacity, and co-organizers.
- `src/models/Registration.js`: participant-event registrations and status.
- `src/models/AuditLog.js`: administrative and event-management history.

Never store a plaintext password or session token. Do not accept `roles`, `ownerId`, `registeredCount`, or participant IDs from the frontend as authoritative values.

## Utilities

### `src/utils/http.js`

Provides shared HTTP helpers:

- `asyncHandler()` forwards rejected async route handlers to Express error handling.
- `fail()` creates an error with an HTTP status.
- `validId()` checks MongoDB ObjectId format.
- `safeUser()` converts a user document to its safe JSON representation.

## Tests

### `tests/smoke.test.js`

Checks that the Express application can be constructed. Add endpoint and MongoDB integration tests as the backend test suite grows.
