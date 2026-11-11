# EDU-27 backend integration contract

**Status: PROPOSED, awaiting team agreement.** This document does not mark EDU-27 or any dependency complete. Frontend review: [PR #11](https://github.com/tharushikadilrukshi111-hash/EduTrack/pull/11).

## Existing implementation

`backend/server.js` implements health, login, current User (`GET /api/auth/me`), and Teacher dashboard routes. Current User responses contain `id`, `name`, `role`, and `identifier`; they do not expose the Student profile. Neither Student endpoint below exists yet. QR issuance and verification are not implemented.

Models: [User](../backend/models/User.js) stores name and login identifier; [Student](../backend/models/Student.js) links a unique `userId` to a registration number; [Class](../backend/models/Class.js) stores class details and `studentIds` referencing **Student documents**, not Users.

## PROPOSED Student APIs

Both proposed requests have no body and require `Authorization: Bearer <login JWT>` over HTTPS in deployment. Derive identity from the verified token subject; do not accept a caller-selected Student ID. Reuse `requireAuth` and Student-only authorization. Also verify the User exists and currently has role `student`: existing `requireRole` checks the token claim only.

### PROPOSED: GET /api/student/profile

HTTP 200:

```json
{
  "student": {
    "id": "<Student ID>",
    "name": "<Student name>",
    "registrationNumber": "<registration number>"
  }
}
```

Map `id` from Student, `name` from User, and `registrationNumber` from Student. Do not assume `User.identifier` always equals `Student.registrationNumber`. Exclude passwords, password hashes, email, phone, date of birth, and parent details.

### PROPOSED: GET /api/student/classes

HTTP 200 for a valid Student with no matching enrollments:

```json
{ "classes": [] }
```

Proposed nonempty response, using illustrative values only:

```json
{
  "classes": [
    {
      "id": "<Class ID>",
      "name": "<class name>",
      "subject": "<subject>",
      "teacherName": "<teacher name>",
      "schedule": [
        { "day": "Monday", "startTime": "16:00", "endTime": "18:00" }
      ]
    }
  ]
}
```

`id` maps from Class `_id`; `name`, `subject`, and `schedule` are Class fields. `teacherName` is a proposed derived field from `Class.teacherId -> User.name`, not a stored Class field; return null if unavailable. Return `schedule: []` when absent. Class also stores description, fee, and `isActive`; these are not required for the initial card. Never return classmates' `studentIds`.

Lookup and ownership:

1. Authenticate the current User using the verified JWT subject and confirm Student authorization.
2. Find `Student` with `{ userId: authenticatedUser._id }`.
3. Find `Class` documents with `{ studentIds: student._id }`.
4. Return only that Student's classes, selecting the agreed response fields.

Open decisions: active-only versus historical classes, schedule timezone, ordering, and any pagination. Do not silently select these policies during mobile integration.

### PROPOSED HTTP errors

Use a consistent JSON response, for example `{ "code": "STUDENT_PROFILE_NOT_FOUND", "message": "Student profile is unavailable." }`. Error codes are proposed additions, not existing API guarantees.

| Status | Meaning |
|---|---|
| 200 | Valid profile or classes result; an empty array is successful |
| 401 | Missing, invalid, expired JWT, invalid subject, or deleted User |
| 403 | Current User is not a Student |
| 404 | User has no linked Student profile; do not return an empty list instead |
| 500 | Unexpected server/database failure; no internal details in response |

## Mobile handling

`MyClassesScreen` currently supports `idle`, `loading`, `success`, and `error`, with Retry only when `onRetry` is a function. Until connected, preserve the idle not-connected message. On integration, show loading during requests, class cards for valid nonempty success, and **No enrolled classes yet** only for a successful empty array. Network failures and malformed successful data must show an error rather than an empty list.

Map unique string class IDs and names into `ClassCard`; optional `subject`, `teacherName`, and `scheduleLabel` must be strings or null/undefined. Format the proposed structured schedule into `scheduleLabel` in the mobile adapter. Validate responses before rendering. On 401, use secure session-expiry handling; distinguish access denial and missing profile from connection errors. Ignore late responses after logout/account changes and clear account-specific data.

The QR card currently displays session `name` and `identifier` plus a placeholder. Future profile integration should supply the actual registration number through an explicit mobile mapping.

## QR identity: requirements and open decisions

**No QR endpoint or final payload contract is proposed here.** Agree purpose first: identity lookup, attendance, or another action; scanner roles and permissions; online/offline verification; payload privacy; expiry, revocation, replay protection, and copied/screenshot handling.

Options to evaluate are an opaque reference verified online or a separately signed, purpose-limited credential. Neither is agreed or implemented. Never use login JWTs, passwords, signing keys, or other secrets as QR payloads. Do not encode unnecessary personal data or treat a registration number alone as proof of identity. Keep the non-scannable placeholder until issuance and verification requirements are agreed and implemented.

## Responsibilities, dependencies, and verification

| Owner | Required work |
|---|---|
| Backend task owner | Agree contracts/policies; implement Student authorization, profile and enrollment lookup, field selection, errors, and API tests; design QR issuance/verification after decisions |
| EDU-27 mobile owner | Integrate agreed APIs, validate/map responses, manage loading/empty/error/Retry and session expiry, preserve navigation, and run Android regression/integration tests |

EDU-23, EDU-24, and EDU-25 are dependency checkpoints requiring teammate confirmation. Their descriptions, ownership, and completion are not established by the repository; no specific API is attributed to them here. Confirm which issue supplies Student profile data, class/enrollment management, and any QR prerequisites. EDU-27 depends on those capabilities becoming available, not merely on task status.

Backend API tests must cover valid Student profile, own enrolled classes, genuine empty enrollment, missing profile, missing/invalid/expired JWT, non-Student access, deleted/changed-role Users, and server failures. Use two Students to prove cross-account isolation and that enrollment matches Student IDs rather than User IDs. Check response types and absence of secrets/classmate data.

Mobile integration tests must cover loading, valid/empty/malformed success, error, Retry present/absent, 401 handling, account changes, and both Back paths. Existing Android smoke tests were user-confirmed; data-driven React Native state runtime/integration tests remain pending. No tests are claimed as executed by this document.
