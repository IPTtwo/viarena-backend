# ViArena backend

Express/Mongoose API for https://github.com/IPTtwo/viarena-frontend. Persists accounts, events, registrations, teams, tasks, schedules, stream links, participation verification, join codes and audit records. Requires Node.js 20+; use 22 or 24 for development.

## Local setup

Run from this repository root after all integration tickets are merged:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Set MONGODB_URI privately in .env to your Atlas URI including the viarena database, or a local MongoDB replica set. Transactions require a replica set. Add the backend machine's public IP to Atlas Network Access and use a database user with read/write access to viarena. Never commit credentials or .env.

Health URL: http://localhost:5000/api/health. Run the frontend independently on 5173 with /api proxied to this API. Login uses HTTP-only cookies and requests include credentials. Production cookies require HTTPS.

## Verify

```powershell
npm run check
npm test
```

Tests use a disposable MongoDB replica set, not your configured database. First run downloads a binary and needs internet. scripts/browser-test-server.js is exclusively for browser tests: it seeds a disposable organizer and listens on 5001. Never deploy that test server.

## First administrator

With .env pointing to the intended database:

```powershell
$env:ADMIN_PASSWORD = Read-Host 'Enter a strong new admin password'
npm run create-admin -- admin@adnu.edu.ph ADMIN-001 'Campus Administrator'
Remove-Item Env:ADMIN_PASSWORD
```

This refuses to overwrite existing accounts. Passwords require 8–128 characters, uppercase, lowercase and a digit. Public signup creates Participant; Admin grants Organizer with an audit reason. Temporary local overrides are not production fixtures.

## Hosting

Deploy as a Node web service: build npm ci --omit=dev, start npm start, health path /api/health. Set NODE_ENV=production, MONGODB_URI, CLIENT_ORIGIN (frontend HTTPS URL), RESET_BASE_URL, COOKIE_NAME, SESSION_DAYS and SCHOOL_EMAIL_DOMAIN privately in your host. Let the host supply PORT. Add its outbound IP ranges to Atlas Network Access.

Use the frontend production server to proxy /api to this backend. Same-origin cookies are the supported default. TRUST_PROXY_HOPS defaults to zero; use only a verified bounded proxy topology (0–5). SESSION_SECRET stays in the example environment for compatibility but is not read by the current random database-backed session-token implementation.

Password-reset email delivery is not implemented. Development logs links; production needs an email provider. Stream settings store external links, not video. No multipart upload endpoint exists. See the distributed package's API documentation, master integration guide and Atlas deployment guide for complete contracts and operational checks. Older repository guides describe the pre-integration starter; this README and package documents describe the integrated implementation.
