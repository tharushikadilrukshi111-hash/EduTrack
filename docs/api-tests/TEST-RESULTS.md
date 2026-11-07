# EduTrack Authentication API Test Results

- Jira task: EDU-22 ? Login Screens and API Testing
- Test date: 2026-11-08 (Asia/Colombo)
- Execution time: 08/11/2026, 00:12:29 (Asia/Colombo)
- Branch: feature/mobile-navigation
- Target: `http://localhost:5000`
- Method: Real HTTP requests using Node.js fetch; no mocked services or database results.

## Results

**9/9 tests passed.**

| Test | Method and endpoint | Expected HTTP | Actual HTTP | Result |
|---|---|---|---|---|
| Health | GET `/api/health` | 200 | 200 | PASS |
| student login | POST `/api/auth/login` | 200 | 200 | PASS |
| teacher login | POST `/api/auth/login` | 200 | 200 | PASS |
| student current user | GET `/api/auth/me` | 200 | 200 | PASS |
| teacher current user | GET `/api/auth/me` | 200 | 200 | PASS |
| teacher Teacher dashboard access | GET `/api/teacher/dashboard` | 200 | 200 | PASS |
| student Teacher dashboard access | GET `/api/teacher/dashboard` | 403 | 403 | PASS |
| Missing JWT | GET `/api/auth/me` | 401 | 401 | PASS |
| Invalid Student password | POST `/api/auth/login` | 401 | 401 | PASS |

## Verification and observations

Successful login responses were checked for JWT shape and exact top-level fields (`token`, `user`). Successful user responses were checked for the exact fields `id`, `name`, `role`, and `identifier`. Current-user and Teacher dashboard account details were compared to the login account. Health required `status: ok` and `database: connected`. Error responses were checked for a message-only contract. Assertions were executed per test; only PASS rows met every applicable check.

The token field is intentionally present in successful login responses. No other response fields, including password hashes, were permitted by the assertions. This verifies the tested response contracts; it is not a comprehensive security audit.

Credentials were loaded in memory from the existing backend development environment; JWTs remained in memory and were passed directly in Bearer headers. No credentials, JWT values, account identifiers, database URIs, or response payloads are recorded here.

The backend was already available and reported MongoDB connected. Backend restart and seed execution were unnecessary; no database writes were requested by these tests. MongoDB connectivity was verified through the application health endpoint, not by inspecting a separate local MongoDB process.

## Failures and limitations

No failures occurred. All nine requested tests executed.

Android UI behavior, expired tokens, deleted accounts, load/performance, and wider security testing are outside this run. Existing Postman and REST Client documentation was inspected; requests were executed programmatically against the same routes.
