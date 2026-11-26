
# ViArena backend and deployment guide

ViArena uses a React/Vite frontend and an Express/Mongoose API in separate repositories. MongoDB stores accounts, cookie sessions, events, registrations, teams, tasks, schedules, streams, participation and audit records. The frontend calls `/api` through a same-origin proxy.

## Requirements

- Node.js 22 or 24 LTS and npm; both projects support Node.js 20+.
- MongoDB Atlas or a local replica set. Registration transactions do not work with standalone MongoDB.
- Both repositories. Substitute your folders for the Windows paths below on another machine.

## Run locally

### MongoDB setup

In Atlas, create a database user with read/write access to `viarena`, add your public IP under Network Access, then copy the URI from Connect → Drivers. Use the database user's password, not your Atlas website password. Percent-encode special characters in the username/password and include the database name.

```env
MONGODB_URI=mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/viarena?retryWrites=true&w=majority
```

For local MongoDB, initialize a replica set named `rs0` and use the URI in [.env.example](./.env.example).

### Backend: terminal 1

```powershell
cd C:\Users\shean\Documents\GitHub\viarena-backend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` privately with your database URI, then start:

```powershell
npm run dev
```

Expect `MongoDB connected` and a listener at `http://localhost:5000`. Keep the terminal running. `npm start` runs without file watching.

| Backend variable | Local value / purpose |
| --- | --- |
| `NODE_ENV` | `development`; `production` enables Secure cookies |
| `PORT` | `5000` locally; managed hosts supply their own port |
| `MONGODB_URI` | Private database URI, required |
| `CLIENT_ORIGIN` | `http://localhost:5173`; comma-separated exact origins if needed |
| `COOKIE_NAME` | `viarena_session` |
| `SESSION_DAYS` | `7` |
| `SCHOOL_EMAIL_DOMAIN` | `adnu.edu.ph` |
| `RESET_BASE_URL` | `http://localhost:5173/reset-password` |
| `TRUST_PROXY_HOPS` | `0` locally; increase only for a verified proxy chain |

Sessions use random tokens stored as hashes in MongoDB. `SESSION_SECRET` is unused and may be removed from older environment files. Never commit `.env` or put database credentials in frontend `VITE_` variables.

### Frontend: terminal 2

```powershell
cd C:\Users\shean\Documents\GitHub\ViArena\client
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Frontend `.env`:

```env
VITE_API_BASE_URL=/api
API_PROXY_TARGET=http://127.0.0.1:5000
```

Open **http://localhost:5173**. Use one hostname consistently for cookies. Restart the relevant server after environment changes.

### Verify the connection

```powershell
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5173/api/health
Invoke-RestMethod http://localhost:5173/api/workspace
```

Health returns `status: ok`; workspace also checks database access. Health alone is a process check, not database readiness. New databases contain no demo accounts or events.

Test signup → login → refresh → profile save → refresh → logout. Accounts and changes persist in MongoDB, not browser localStorage.

## First administrator and application use

Public signup creates Participants. Passwords require 8–128 characters, uppercase, lowercase and a digit. In the backend folder with `.env` pointing to the intended database:

```powershell
$adminPassword = Read-Host 'New administrator password' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminPassword).Password
try {
  npm run create-admin -- admin@adnu.edu.ph ADMIN-001 "Campus Administrator"
} finally {
  Remove-Item Env:ADMIN_PASSWORD
  Remove-Variable adminPassword
}
```

This creates a new Participant/Organizer/Admin account and refuses existing emails/student IDs. It writes to the configured database. Do not put passwords in command arguments or source files.

1. As Admin, grant Organizer access from User Management with an audit reason.
2. As Organizer, create/publish events and configure staff, teams, schedules and stream links.
3. Participants discover published events and register while capacity remains and registration is open.
4. Staff manage registrations and verify participation. Managers assign team tasks; participants update status.
5. Reassign an Organizer's owned events before revoking their role.

Production password-reset email delivery is not implemented; development reset links appear in backend logs. Streams are external links. Images use bounded JSON/data URLs; there is no multipart upload service.

## Tests and commands

Backend:

```powershell
npm run check
npm test
```

These use a disposable MongoDB replica set, not your `.env` database. The first run may download MongoDB and needs internet.

Frontend, from `client`:

```powershell
npm test
npx playwright install chromium
npm run test:e2e
```

Browser tests build the frontend and use temporary ports `5001`, `5174`, `5175`. They expect a sibling backend named `viarena-backend`; otherwise set `$env:BACKEND_DIR` to its absolute path. Install dependencies in both repositories first. [scripts/browser-test-server.js](./scripts/browser-test-server.js) is test-only; never deploy it.

| Command | Purpose |
| --- | --- |
| Backend `npm run dev` / `npm start` | Watch mode / ordinary Node server |
| Backend `npm run create-admin -- ...` | Create a new administrator |
| Frontend `npm run dev` | Vite with local API proxy |
| Frontend `npm run build` | Production assets in `dist` |
| Frontend `npm run preview` | Local build preview |
| Frontend `npm start` | Serve `dist` and proxy `/api` on an ordinary Node host |

## Deploy both repositories on Vercel

Create **two Vercel projects**, one API and one frontend. Browser requests stay at the frontend's `/api`; external rewrites forward them to the backend for same-origin HTTP-only sessions.

The default export in [src/app.js](./src/app.js) is the Vercel entry. Database connections initialize on API requests and are reused within each warm function. Vercel does not run the local watcher. See [Vercel's Express guide](https://vercel.com/docs/frameworks/backend/express).

### 1. Prepare Atlas and Git

1. Commit/push intended changes in both repositories. These instructions do not push or deploy automatically.
2. Prepare an Atlas database/user for deployment and allow the Vercel backend network. Serverless outbound addresses can change: use an Atlas integration, fixed egress/private networking where available, or an access list appropriate to your hosting. `0.0.0.0/0` allows connections from anywhere and should be an explicit choice with strong database credentials. See [Atlas connection requirements](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).
3. Choose a stable frontend URL. Replace all example domains below with your actual project domains.

### 2. Deploy the backend first

Choose **Add New → Project** in Vercel and import the backend repository:

| Setting | Value |
| --- | --- |
| Root Directory | Repository root (`.`) |
| Framework Preset | Express / automatic Express detection |
| Install Command | `npm ci` |
| Build Command / Output Directory | Framework defaults; no frontend build or `dist` |
| Node.js version | 22.x or 24.x, matching local development |

Set these server-only environment variables for the intended environment, then deploy:

```env
NODE_ENV=production
MONGODB_URI=YOUR_PRIVATE_ATLAS_URI_WITH_DATABASE_NAME
CLIENT_ORIGIN=https://viarena-web.vercel.app
COOKIE_NAME=viarena_session
SESSION_DAYS=7
SCHOOL_EMAIL_DOMAIN=adnu.edu.ph
RESET_BASE_URL=https://viarena-web.vercel.app/reset-password
TRUST_PROXY_HOPS=1
```

`TRUST_PROXY_HOPS=1` assumes direct deployment behind Vercel's ingress; reassess it when adding proxies. Do not set `PORT` or `VERCEL` manually. Record the backend production origin, e.g. `https://viarena-api.vercel.app`. Check `/api/health` and `/api/workspace`. The root `/` intentionally returns JSON 404 because this project serves the API only.

If deployment protection returns a protection/login page to the frontend proxy, configure production access so the intended proxy can reach the API. Treat preview protection/databases separately.

### 3. Configure and deploy the frontend

Edit `client/vercel.json` in the frontend repository. Replace **both** `https://replace-with-your-backend.vercel.app` destinations with the real backend production origin. Preserve `/api` in the destination paths. API rules must precede the SPA fallback:

```json
{
  "rewrites": [
    { "source": "/api", "destination": "https://viarena-api.vercel.app/api" },
    { "source": "/api/:path*", "destination": "https://viarena-api.vercel.app/api/:path*" },
    { "source": "/((?!api(?:/|$)).*)", "destination": "/index.html" }
  ]
}
```

Commit/push the domain change, then import the frontend repository as a second project:

| Setting | Value |
| --- | --- |
| Root Directory | `client` |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js version | Same as backend |
| Environment variable | `VITE_API_BASE_URL=/api` |

Vercel serves static assets and applies rewrites. It does **not** run `npm start` or `scripts/serve.mjs`. `API_PROXY_TARGET` controls local Vite/ordinary Node hosting and does **not** configure Vercel routing. Rewrite changes need deployment; Vite environment changes need rebuild. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [external rewrites](https://vercel.com/docs/routing/rewrites).

### 4. Finish and verify

1. Set backend `CLIENT_ORIGIN` and `RESET_BASE_URL` to the final frontend URL and redeploy. Align them again when adding a custom domain.
2. Create the first Admin using the script above from a private local environment pointing to the deployed database.
3. Visit `https://YOUR_FRONTEND/api/health` and `/api/workspace`. Expect JSON, not frontend HTML or a protection page.
4. Test signup → login → refresh → save → refresh → logout, then Organizer publishing and Participant registration/cancellation.
5. Refresh `/profile` to check SPA routing. Missing `/api` routes must remain JSON 404s.
6. Check backend function logs for database/errors without logging secrets or session cookies.

For Preview deployments, use a separate database and explicitly configure backend destinations and allowed frontend origins. The committed rewrite has a fixed backend URL: previews use it too unless you change that deployment's configuration. Avoid connecting unreviewed previews to production data.

## Ordinary Node hosting alternative

Backend: `npm ci --omit=dev`, then `npm start`. Frontend: `npm ci`, `npm run build`, then `npm start` with runtime `API_PROXY_TARGET=https://YOUR_BACKEND` and host-supplied `PORT`. The frontend server does not load Vite `.env` at runtime; supply runtime values in the host or shell. HTTPS is required for production Secure cookies.

## API and Postman reference

Set a Postman variable `baseUrl=http://localhost:5000/api`. Send JSON with `Content-Type: application/json`. Postman keeps login cookies in its cookie jar; no bearer token is needed. API signup does not log in automatically; the frontend explicitly logs in afterward.

| Method/path relative to `/api` | Purpose |
| --- | --- |
| `GET /health`, `GET /workspace` | Process health / permission-filtered snapshot |
| `POST /auth/signup` | `{name,email,studentId,password}`; Participant only |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Cookie sessions |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | Recovery / `{token,password}` reset |
| `PATCH /users/me` | Own `name`, `studentId`, `bio`, `avatar`; roles rejected |
| `GET /events`, `GET /events/:eventId` | Published list / detail; drafts restricted |
| `POST /events`, `PATCH /events/:eventId` | Create draft / edit permitted fields |
| `POST /events/:eventId/publish`, `POST /events/:eventId/unpublish` | Visibility |
| `POST /events/:eventId/registrations` | Atomic registration/capacity check |
| `DELETE /events/:eventId/registrations/me` | Own cancellation before start |
| `GET /me/registrations` | Own active registrations |
| `GET /events/:eventId/registrations` | Authorized roster |
| `DELETE /events/:eventId/registrations/:registrationId` | Staff cancellation |
| `GET /admin/users`, `GET /admin/users/:userId` | Admin user list/detail |
| `POST /admin/users/:userId/organizer-role` | `{grant,reason}`; audited role change |
| `GET /admin/users/:userId/role-history` | Role history |
| `GET /workspace/join/:code` | Enabled published-event join code lookup |
| `POST /workspace/actions/:action` | Authorized workspace mutation |

Workspace actions: `createTeam`, `placeMember`, `assignTeamRole`, `saveTask`, `updateTaskStatus`, `saveSchedule`, `removeSchedule`, `saveStream`, `confirmParticipation`, `setCoOrganizer`, `reassignEventOwner`, `generateJoinCode`, `disableJoinCode`. Exact bodies are in [action schemas](./src/routes/workspace.js) and [integration request examples](./tests/integration.test.js).

## Code map

| Location | Responsibility |
| --- | --- |
| [src/server.js](./src/server.js) | Environment, database, ordinary Node listener |
| [src/app.js](./src/app.js) | Express, API/errors, Vercel export |
| [src/config/db.js](./src/config/db.js) | Reusable database connection |
| [src/routes/](./src/routes/) | Auth, profiles, events, registrations, admin, workspace |
| [src/controllers/](./src/controllers/), [src/services/](./src/services/) | Auth/profile operations |
| [src/middleware/auth.js](./src/middleware/auth.js) | Sessions and event permissions |
| [src/models/](./src/models/) | MongoDB schemas/indexes |
| [src/validators/](./src/validators/) | Auth/profile validation |
| [scripts/](./scripts/), [tests/](./tests/) | Admin CLI, disposable browser server, tests |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| MongoDB error `8000` | Database user, encoded password, URI database/auth settings |
| MongoDB timeout | Atlas IP list, network, DNS, cluster availability |
| Replica set required | Atlas or initialized local `rs0` |
| Frontend connection error / 502 | Backend port 5000; proxy target has no `/api` suffix |
| Session lost on refresh | Consistent hostname, cookies, production HTTPS, API rewrites |
| Vercel API returns HTML | Protection page, wrong backend domain, SPA fallback intercepting API |
| Vercel 500 | Server-side environment/function logs; health does not check MongoDB |
| Empty events | New database; an Organizer must publish content |
| Port in use | Stop the earlier process with Ctrl+C before restarting |

Older standalone API, file, integration and Postman guides were consolidated here.
