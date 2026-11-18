# Testing the ViArena API with Postman

This guide explains how to test the backend manually with Postman.

## 1. Start the backend

From the backend repository:

```bash
npm install
npm run dev
```

The backend should be available at:

```text
http://localhost:5000
```

MongoDB must also be running. Registration endpoints use MongoDB transactions, so local MongoDB must run as a replica set or the database must be MongoDB Atlas.

## 2. Create a Postman environment

Create an environment called `ViArena Local` with these variables:

| Variable | Initial value | Current value |
|---|---|---|
| `baseUrl` | `http://localhost:5000/api` | `http://localhost:5000/api` |
| `eventId` | empty | empty |
| `registrationId` | empty | empty |
| `userId` | empty | empty |

Use requests such as:

```text
{{baseUrl}}/health
{{baseUrl}}/auth/login
```

## 3. Check that the API is running

Create a `GET` request:

```text
{{baseUrl}}/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## 4. Create a participant account

Create a `POST` request:

```text
{{baseUrl}}/auth/signup
```

Headers:

```text
Content-Type: application/json
```

Body → `raw` → `JSON`:

```json
{
  "name": "Test Student",
  "email": "student@adnu.edu.ph",
  "studentId": "2025-0001",
  "password": "Password1"
}
```

The password must contain at least eight characters, including uppercase, lowercase, and a number.

Expected status: `201 Created`.

Copy the returned user ID into the `userId` environment variable if needed.

## 5. Log in

Create a `POST` request:

```text
{{baseUrl}}/auth/login
```

Body:

```json
{
  "email": "student@adnu.edu.ph",
  "password": "Password1"
}
```

After sending the request, Postman should save the `viarena_session` cookie for `localhost`. The cookie is required for private requests.

To check the logged-in user:

```text
GET {{baseUrl}}/auth/me
```

If Postman returns `401 Authentication required`, check that the cookie is enabled and that the request is using the same `localhost` host.

## 6. Test public events

List published events:

```text
GET {{baseUrl}}/events?page=1&limit=12&status=upcoming
```

Get one event:

```text
GET {{baseUrl}}/events/{{eventId}}
```

Only published events are returned by the public endpoints.

## 7. Test participant registration

The participant must be logged in first.

Register for an event:

```text
POST {{baseUrl}}/events/{{eventId}}/registrations
```

No request body is required.

Expected status: `201 Created`.

View the participant's registrations:

```text
GET {{baseUrl}}/me/registrations
```

Cancel a registration:

```text
DELETE {{baseUrl}}/events/{{eventId}}/registrations/me
```

The API prevents duplicate registrations, registration after the deadline, registration after an event starts, and registrations after capacity is reached.

## 8. Test profile updates

Create a `PATCH` request:

```text
{{baseUrl}}/users/me
```

Body:

```json
{
  "name": "Updated Student",
  "bio": "Computer science student"
}
```

Users cannot update their own roles through this endpoint.

## 9. Test organizer endpoints

These requests require a user with the `Organizer` role. A normal signup creates a `Participant`, so an administrator must grant the role first.

Create an event:

```text
POST {{baseUrl}}/events
```

Body:

```json
{
  "title": "Community Workshop",
  "category": "Workshop",
  "description": "A sample event for API testing.",
  "venue": "Main Hall",
  "start": "2026-12-10T09:00:00.000Z",
  "end": "2026-12-10T12:00:00.000Z",
  "deadline": "2026-12-09T23:59:59.000Z",
  "capacity": 50,
  "cover": ""
}
```

Copy the returned event ID into the `eventId` variable.

Publish the event:

```text
POST {{baseUrl}}/events/{{eventId}}/publish
```

Update the event:

```text
PATCH {{baseUrl}}/events/{{eventId}}
```

Body:

```json
{
  "venue": "Updated Hall",
  "capacity": 75
}
```

## 10. Test admin endpoints

These requests require an authenticated user with the `Admin` role.

List users:

```text
GET {{baseUrl}}/admin/users?page=1
```

Get one user:

```text
GET {{baseUrl}}/admin/users/{{userId}}
```

Grant the Organizer role:

```text
POST {{baseUrl}}/admin/users/{{userId}}/organizer-role
```

Body:

```json
{
  "grant": true,
  "reason": "Approved as an event organizer"
}
```

View role history:

```text
GET {{baseUrl}}/admin/users/{{userId}}/role-history
```

## 11. Test error behavior

Useful negative tests include:

| Test | Expected status |
|---|---:|
| Invalid email or password format | `400` |
| Wrong login credentials | `401` |
| Private request without login | `401` |
| Participant calling an admin endpoint | `403` |
| Unknown event ID | `404` |
| Duplicate registration | `409` |
| Event at capacity | `409` |

Error responses normally look like:

```json
{
  "error": "Authentication required"
}
```

## 12. Logging out

Create a `POST` request:

```text
{{baseUrl}}/auth/logout
```

The backend removes the session and clears the cookie. After logout, calling `GET {{baseUrl}}/auth/me` should return `401`.

## Common problems

### `ECONNREFUSED`

The backend is not running or the URL is incorrect. Start it with `npm run dev` and check that Postman uses port `5000`.

### `MongoDB connected` never appears

Check `MONGODB_URI` in `.env`. Make sure MongoDB is running and reachable.

### Registration returns a transaction error

The MongoDB server is probably running as a standalone server. Use MongoDB Atlas or configure a local replica set.

### Every private request returns `401`

Log in again and confirm that Postman saved the `viarena_session` cookie for `localhost:5000`.

### A participant receives `403`

That endpoint requires an Organizer or Admin role. Roles are assigned by an authorized admin, not by changing the request body.
