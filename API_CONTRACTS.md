# Backend contracts for Phase 2 (not implemented in this ZIP)

Implement with Express and MongoDB, authenticated HTTP-only server-managed sessions or short-lived verified tokens. Do not trust roles, owner IDs, counts, or participant IDs sent by the browser.

| Ticket | Method / route | Intended behavior |
|---|---|---|
| VIA-202 | `POST /api/auth/signup` | School email, password validation, Participant-only role |
| VIA-202 | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Secure session lifecycle |
| VIA-202 | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | Single-use expiring recovery token, generic response |
| VIA-202 | `PATCH /api/users/me` | Edit own non-role profile fields |
| VIA-204 | `GET /api/events?visibility=published&search=&category=&status=&page=` | Paginated published events only |
| VIA-205 | `GET /api/events/:eventId`, `GET /api/me/registrations` | Public data / own registrations |
| VIA-205 | `POST /api/events/:eventId/registrations` | Authenticated, duplicate prevention, atomic capacity check |
| VIA-205 | `DELETE /api/events/:eventId/registrations/me` | Own allowed cancellation |
| VIA-206 | `POST /api/events`, `PATCH /api/events/:eventId`, `POST /api/events/:eventId/publish` | Organizer creation, owner/scoped editor; audit |
| VIA-207 | `GET /api/events/:eventId/registrations` | Authorized event staff only; PII-minimized response |
| VIA-207 | `DELETE /api/events/:eventId/registrations/:registrationId` | Authorized staff only, audit and count update |
| VIA-208 | `GET /api/admin/users`, `GET /api/admin/users/:userId` | Admin-only accounts |
| VIA-208 | `POST /api/admin/users/:userId/organizer-role` | Admin assign/revoke, reason and audit; block revoke if owned events not reassigned |
| VIA-208 | `GET /api/admin/users/:userId/role-history` | Admin-only audit entries |

Recommended MongoDB collections: `users`, `events`, `registrations`, `auditLogs`, and `sessions`. Index normalized email and student ID uniquely, and active registration `{eventId,userId}` uniquely. Use MongoDB transactions or a capacity reservation strategy so concurrent registrations cannot exceed capacity. Verify Co-organizer permissions per event and per operation; never infer permissions solely from React routes.

## Frontend integration convention

Set `VITE_API_BASE_URL=/api` in `client/.env`. Replace local fixture actions in `client/src/store.jsx` with an API service when the server is ready. Change the client in one reviewed PR with corresponding server endpoints and integration tests. A URL value alone **does not** switch the current store to server persistence.
