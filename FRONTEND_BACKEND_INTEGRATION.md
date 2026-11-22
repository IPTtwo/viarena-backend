# Connecting the Frontend to the Backend

The frontend and backend are separate repositories. They communicate through the backend's HTTP API; the frontend does not import backend files directly.

## Local setup

Start MongoDB, then start the backend from this repository:

```bash
npm install
npm run dev
```

The API runs at:

```text
http://localhost:5000
```

In the frontend repository, create `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

The backend `.env` must allow the frontend origin:

```env
CLIENT_ORIGIN=http://localhost:5173
```

## Frontend API helper

Create one API helper in the frontend instead of repeating URLs throughout components:

```js
const API_URL = import.meta.env.VITE_API_BASE_URL;

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Request failed');
  }
  return body;
}
```

`credentials: 'include'` is required because login creates an HTTP-only session cookie. JavaScript cannot read that cookie, but the browser sends it on later API requests.

## Authentication example

```js
await api('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});

const { user } = await api('/auth/me');
```

Logout:

```js
await api('/auth/logout', { method: 'POST' });
```

The frontend should use the `/auth/me` response when the application starts rather than assuming that a local user object is still valid.

## Main endpoint groups

| Purpose | Endpoints |
|---|---|
| Authentication | `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/me` |
| Password recovery | `/auth/forgot-password`, `/auth/reset-password` |
| Profile | `PATCH /users/me` |
| Public events | `GET /events`, `GET /events/:eventId` |
| Registrations | `GET /me/registrations`, `POST /events/:eventId/registrations` |
| Organizer events | `POST /events`, `PATCH /events/:eventId`, `POST /events/:eventId/publish` |
| Admin | `/admin/users` and related role-history endpoints |

See [`API_CONTRACTS.md`](./API_CONTRACTS.md) for the full contract.

## Testing the API

### Health check

PowerShell:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

Expected response:

```json
{ "status": "ok" }
```

### Signup

```powershell
$body = @{ name = 'Test Student'; email = 'student@adnu.edu.ph'; studentId = '2025-0001'; password = 'Password1' } | ConvertTo-Json
Invoke-RestMethod http://localhost:5000/api/auth/signup -Method Post -ContentType 'application/json' -Body $body
```

### Login with curl

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"student@adnu.edu.ph","password":"Password1"}' \
  http://localhost:5000/api/auth/login
```

The `-c cookies.txt` option saves the session cookie.

### Call an authenticated endpoint

```bash
curl -i -b cookies.txt http://localhost:5000/api/auth/me
```

The `-b cookies.txt` option sends the saved session cookie.

### List published events

```bash
curl "http://localhost:5000/api/events?page=1&limit=12&status=upcoming"
```

## Response status codes

| Code | Meaning |
|---:|---|
| `200` | Request succeeded. |
| `201` | Resource created, such as a user or registration. |
| `400` | Invalid input or malformed MongoDB identifier. |
| `401` | The user is not authenticated or the session expired. |
| `403` | The user is authenticated but lacks permission. |
| `404` | The resource or route does not exist. |
| `409` | Conflict, such as duplicate registration or a full event. |
| `500` | Unexpected server error. Check backend logs. |

Error responses normally have this shape:

```json
{ "error": "Authentication required" }
```

Validation errors may also include a `details` object.

## Rules for frontend developers

- Use API response IDs from MongoDB; do not create or depend on fixture IDs such as `evt-123`.
- Do not send roles, event ownership, registration counts, or participant IDs as authority data.
- Refresh the current user with `/api/auth/me` after login and on application startup.
- Handle `401`, `403`, `409`, and validation errors explicitly in the UI.
- Keep API calls in a frontend service/store layer rather than inside many components.
- Never put `SESSION_SECRET`, `MONGODB_URI`, or other backend secrets in the Vite environment.

## Production connection

Prefer serving the API behind the same origin:

```text
https://viarena.example.com       frontend
https://viarena.example.com/api   backend
```

Then the frontend can use:

```env
VITE_API_BASE_URL=/api
```

This simplifies cookies and CORS. Production must use HTTPS, a strong session configuration, a trusted proxy/reverse proxy, and a configured email provider for password recovery.
