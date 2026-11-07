# EduTrack REST API Specification

- Jira: EDU-58 — REST API Specification
- Reviewed: 8 November 2026
- Scope: implemented Express routes in `backend/server.js` and authentication rules in `backend/middleware/auth.js`.
- Development base URL: `http://localhost:5000`. The backend port is configurable.

## 1. Conventions and endpoint overview

Paths below are relative to the base URL. Application responses use JSON. Send `Content-Type: application/json` for login bodies; `Accept: application/json` is recommended for all requests. GET requests have no request body. The JSON body parser has a `20kb` limit.

All examples are fictitious. Password placeholders and `<JWT>` are not usable credentials or tokens. Replace them locally using existing development accounts; never save actual values in this specification.

| Method | Path | Purpose | Authentication |
|---|---|---|---|
| GET | `/api/health` | Application and database connection status | Public |
| POST | `/api/auth/login` | Authenticate a Student or Teacher | Public; credentials in body |
| GET | `/api/auth/me` | Validate a session and retrieve its current account | Bearer JWT; existing Student or Teacher account |
| GET | `/api/teacher/dashboard` | Retrieve Teacher account details | Bearer JWT with Teacher role |

## 2. Authentication and authorization

Login compares the supplied password with the stored bcrypt password hash. Successful login issues a signed JWT containing `sub` (the account ID) and `role`, with a two-hour expiry. Password hashes are never included in the application response objects.

Protected requests must send:

```http
Authorization: Bearer <JWT>
```

The existing middleware requires the exact `Bearer` scheme and a token. It uses `jwt.verify` with the configured server secret to check the signature and token validity, including expiry. Clients must not treat a stored token as proof of an authenticated session without backend validation.

`/api/auth/me` retrieves the account using the verified subject and checks the current database role is `student` or `teacher`. `/api/teacher/dashboard` checks the role in the verified JWT is `teacher`, then retrieves the account. The Teacher route does not independently re-check the database role; role changes therefore do not immediately invalidate its JWT role claim. Deleted accounts return 401 from `/api/auth/me` and 404 from the Teacher route.

There is no server-side logout, token refresh, or token denylist endpoint. Mobile logout deletes the locally stored JWT; this does not revoke copies of an otherwise valid token.

## 3. GET /api/health

**URL:** `http://localhost:5000/api/health`

Reports application availability and Mongoose connection state. No authentication or required headers; no body.

**HTTP 200 example:**

```json
{
  "status": "ok",
  "database": "connected"
}
```

`database` is `connected` only when Mongoose reports ready state 1; otherwise it is `disconnected`. The route still returns HTTP 200 when disconnected. The server initially connects to MongoDB before listening, so startup connection failures can make the HTTP service unavailable entirely.

## 4. POST /api/auth/login

**URL:** `http://localhost:5000/api/auth/login`

Authenticates either supported role and returns a token plus account details. Requires `Content-Type: application/json`; no Bearer header is needed.

| Body field | Type | Requirement and behavior |
|---|---|---|
| `role` | string | Required; exactly `student` or `teacher` |
| `identifier` | string | Required and nonempty after trimming |
| `password` | string | Required and nonempty; compared as supplied |

Student lookup accepts a registration identifier normalized to uppercase or email normalized to lowercase. Teacher lookup uses the lowercased identifier field, which the seed script populates with the Teacher email. Lookup is constrained to the requested role.

The login route does not enforce an eight-character password minimum or email-format validation; those checks exist elsewhere, including the mobile login and seed setup. Parent/Admin roles are rejected by this endpoint.

### Student request example

```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "role": "student",
  "identifier": "EXAMPLE-STUDENT-001",
  "password": "<dummy-student-password>"
}
```

**HTTP 200 example:**

```json
{
  "token": "<JWT>",
  "user": {
    "id": "000000000000000000000001",
    "name": "Example Student",
    "role": "student",
    "identifier": "EXAMPLE-STUDENT-001"
  }
}
```

### Teacher request example

```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "role": "teacher",
  "identifier": "teacher@example.com",
  "password": "<dummy-teacher-password>"
}
```

**HTTP 200 example:**

```json
{
  "token": "<JWT>",
  "user": {
    "id": "000000000000000000000002",
    "name": "Example Teacher",
    "role": "teacher",
    "identifier": "teacher@example.com"
  }
}
```

### Login errors

| HTTP | Condition | Exact `message` |
|---|---|---|
| 400 | Unsupported role, missing/invalid identifier or password type, or empty required value | `Role, identifier and password are required.` |
| 401 | Account not found for the requested role or password does not match | `Invalid login details. Please check and try again.` |
| 500 | Exception during lookup, password comparison, or token creation | `Server error. Try again later.` |

## 5. GET /api/auth/me

**URL:** `http://localhost:5000/api/auth/me`

Validates a stored session and returns the current account. Requires `Authorization: Bearer <JWT>`; no body. Both Student and Teacher accounts are supported. The verified `sub` must be a string of 24 hexadecimal characters.

**HTTP 200 example (Student):**

```json
{
  "user": {
    "id": "000000000000000000000001",
    "name": "Example Student",
    "role": "student",
    "identifier": "EXAMPLE-STUDENT-001"
  }
}
```

A Teacher response uses the same four fields with the Teacher's account details and `role: "teacher"`. No replacement JWT is issued.

| HTTP | Condition | Exact `message` |
|---|---|---|
| 401 | Missing header/token or unsupported authorization scheme | `Authentication required` |
| 401 | Token verification fails, including invalid signature or expiry | `Invalid or expired token` |
| 401 | Verified subject missing or not a 24-character hexadecimal string | `Invalid session.` |
| 401 | Account deleted/not found, or current database role is unsupported | `Account unavailable. Please sign in again.` |
| 500 | Exception while retrieving the account | `Server error. Try again later.` |

## 6. GET /api/teacher/dashboard

**URL:** `http://localhost:5000/api/teacher/dashboard`

Returns the authenticated Teacher's basic account information. Requires `Authorization: Bearer <JWT>` whose verified role claim is `teacher`; no body. A valid Student token receives HTTP 403. This endpoint currently returns profile data only, with no classes, statistics, or dashboard aggregates.

**HTTP 200 example:**

```json
{
  "user": {
    "id": "000000000000000000000002",
    "name": "Example Teacher",
    "role": "teacher",
    "identifier": "teacher@example.com"
  }
}
```

| HTTP | Condition | Exact `message` |
|---|---|---|
| 401 | Missing header/token or unsupported authorization scheme | `Authentication required` |
| 401 | Token verification fails, including invalid signature or expiry | `Invalid or expired token` |
| 403 | Verified JWT role is not `teacher` | `Access denied` |
| 404 | JWT subject resolves to no account | `Teacher account not found.` |
| 500 | Account lookup exception, including an uncastable subject | `Server error. Try again later.` |

## 7. Error response format and framework behavior

Application-generated errors documented above return a single JSON `message` field. For example, a valid Student JWT on the Teacher route returns HTTP 403:

```json
{
  "message": "Access denied"
}
```

Malformed JSON can be rejected by Express before the route with HTTP 400; bodies exceeding the parser limit can produce HTTP 413. There is no custom global JSON error handler, so these framework-generated errors and unknown-route 404 responses are not guaranteed to use the application's JSON message format. Network failures have no HTTP response status.

## 8. Authentication flow

1. The client selects Student or Teacher and submits credentials to `/api/auth/login`.
2. The backend checks the requested account and password. Success returns the JWT and public account fields.
3. The mobile app securely saves the JWT and uses the returned role for dashboard navigation.
4. On startup, the client sends the saved JWT to `/api/auth/me`. Only a successful response for a supported role restores the session.
5. Teacher data requests send the JWT to `/api/teacher/dashboard`; backend middleware enforces Teacher authorization independently of screen visibility.
6. HTTP 401 requires reauthentication; the mobile app removes the invalid saved token before clearing the session. HTTP 403 means access denied. Network/server failures do not establish a valid session and should permit retry without unnecessarily deleting credentials.
7. Logout securely removes the local token and clears mobile authenticated state.

## 9. Implemented scope and planned features

The four routes in this document are the complete currently implemented application API. Student/Teacher login, current-user validation, health reporting, and basic protected Teacher profile access are implemented.

Parent/Admin login, registration/account activation, password recovery, a protected Student dashboard API, refresh/revocation endpoints, and class/material/quiz/result/payment/notification operations are not implemented routes. Database models for some of these domains do not imply available REST endpoints. No method or URL is specified for planned work here.

## 10. Testing evidence and related documents

- [REST Client requests](api-tests/EduTrack.http) and [execution instructions](api-tests/README.md).
- [Live API test results](api-tests/TEST-RESULTS.md): nine requests passed on 8 November 2026, covering health, both logins, both current-user checks, Teacher access, Student denial, missing JWT, and invalid password.
- [Postman authentication collection](postman/EduTrack-Authentication.postman_collection.json) and [instructions](postman/README.md).

The existing live report does not claim runtime coverage of every documented branch, such as all 400/500 paths or account deletion. Those responses were cross-checked against source code for this specification. No new live tests were run to create this document.
