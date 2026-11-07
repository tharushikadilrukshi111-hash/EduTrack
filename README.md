# EduTrack

**Mobile Tuition Management System — Sprint 1 Evaluation**

EduTrack is a two-member university project building a shared mobile platform for tuition learning and administration. Tuition workflows often spread account access, learning materials, assessment results, and payment information across separate channels. EduTrack aims to bring these workflows into one role-based application.

Sprint 1 establishes the authentication foundation: Student and Educator sign-in, secure mobile sessions, protected Teacher API access, MongoDB schemas, API testing, and technical documentation. It does not yet deliver the full tuition-management workflow.

## Project objectives and users

- Provide a mobile entry point with clear role selection and protected access.
- Authenticate users through a Node.js API backed by MongoDB.
- Store mobile session tokens securely and validate them before restoring access.
- Establish reusable schemas and documented APIs for later learning and administration features.
- Maintain traceable contributions and testing evidence for university evaluation.

| User role | Intended purpose | Sprint 1 status |
|---|---|---|
| Student | Access learning activities and personal progress | Login, session restoration, and basic dashboard placeholder implemented |
| Educator (Teacher/Lecturer) | Manage classes and support learners | Uses API role `teacher`; login, restoration, basic dashboard, and protected profile-data loading implemented |
| Parent/Guardian | Follow a linked student's learning | Role-selection/login UI and schema support exist; authentication and workflows are planned |
| Administrator | Manage the tuition platform | Access UI and schema role exist; authentication and management workflows are planned |

## Sprint 1 implemented features

### Mobile application

- Welcome, role-selection, and role-specific login screens.
- Student login using registration number or email; Teacher login using email.
- Required-field, email-format, and minimum-eight-character password checks in the mobile login.
- Returned-role checks and protected dashboard rendering.
- JWT storage and deletion through Expo SecureStore.
- Startup session verification through `/api/auth/me`, with a loading state, retry options, and no restoration based solely on token presence.
- Teacher-only **Load Teacher Data** action with Bearer authentication.
- Expired-session handling, access-denied errors, and protection against stale restoration/Teacher API responses changing newer authentication state.

### Backend and database

- Express health endpoint, Student/Teacher login, authenticated current-user endpoint, and protected Teacher profile endpoint.
- Bcrypt password comparison, signed JWTs with a two-hour expiry, and authentication/role middleware.
- Eight Mongoose models: User, Student, Class, Material, Quiz, Result, Payment, and Notification, including validation rules and declared indexes.
- Environment-driven demo User seeding and linked Student profile creation, using validated upserts.

The full Student and Teacher dashboards remain placeholders. Additional domain models are implemented schemas, not completed feature APIs or screens.

## Technology stack

| Layer | Technologies in this repository |
|---|---|
| Mobile | React Native 0.88.1, React 19.3.0, Expo SDK 58, Expo SecureStore |
| Backend | Node.js, Express 5, dotenv, CORS |
| Persistence | MongoDB, Mongoose 9 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), bcryptjs |
| Testing/documentation | Postman Collection v2.1, VS Code REST Client, Markdown, Mermaid and SVG diagrams |

Mobile navigation currently uses React state in `mobile/App.js`; Expo Router is not an installed navigation implementation.

## Repository structure

```text
EduTrack/
├── backend/
│   ├── middleware/auth.js       # JWT verification and role authorization
│   ├── models/                  # Eight Mongoose models
│   ├── .env.example             # Backend configuration template
│   ├── server.js                # Express routes and database connection
│   ├── seed.js                  # Demo account and Student profile seeding
│   └── package.json
├── mobile/
│   ├── assets/
│   ├── App.js                   # Screens, login, sessions and protected requests
│   ├── app.json
│   └── package.json
├── docs/
│   ├── API-SPEC.md
│   ├── api-tests/               # REST Client requests, template and live report
│   ├── postman/                 # Authentication collection and instructions
│   └── diagrams/                # Class/login sequence Markdown, Mermaid and SVG
└── README.md
```

## Software prerequisites

- Git and npm.
- A Node.js version compatible with the installed packages: Node 22.13+ within the 22.x line or Node 24.3+ within the 24.x line meets their declared engine requirements.
- A running MongoDB Community Server for local development, or an explicitly configured development MongoDB deployment.
- An Android device with an Expo Go version compatible with SDK 58, or an appropriate Expo development build; alternatively, an Android emulator with Android Studio configured.
- VS Code REST Client (`humao.rest-client`) or Postman for interactive API testing.

These instructions use PowerShell and start from the repository root. On Windows, if PowerShell blocks npm/npx scripts, use `npm.cmd` and `npx.cmd` in place of `npm` and `npx`.

## Backend installation and configuration

The integrated Sprint 1 reference is `dev`. Work on feature branches rather than changing `main` or `dev` directly. Install dependencies from the lockfile:

```powershell
cd E:\EduTrack\backend
npm ci
```

Create `backend/.env` from [backend/.env.example](backend/.env.example) **only if it does not already exist**. Preserve existing local configuration. Set the following locally:

| Variable | Purpose |
|---|---|
| `PORT` | Backend HTTP port; default 5000 |
| `MONGODB_URI` | Development MongoDB connection URI; template uses `mongodb://127.0.0.1:27017/edutrack` |
| `JWT_SECRET` | Private signing secret; server requires at least 32 characters |
| `SEED_STUDENT_REG` | Demo Student registration identifier |
| `SEED_STUDENT_EMAIL` | Demo Student email |
| `SEED_STUDENT_PASSWORD` | Private demo Student password, at least eight characters |
| `SEED_TEACHER_EMAIL` | Demo Teacher email and login identifier |
| `SEED_TEACHER_PASSWORD` | Private demo Teacher password, at least eight characters |

Replace template placeholders with local values. Use valid, distinct test emails and a securely generated signing secret. Actual passwords, signing secrets, JWT values, and private database URIs must remain outside version control. Existing ignore rules exclude `.env` files while allowing `.env.example` templates. `EXPO_PUBLIC_*` variables are public application configuration and must never hold secrets.

## MongoDB setup and demo seeding

Start MongoDB using your installation's service or development deployment. For the template URI, MongoDB must be reachable at `127.0.0.1:27017`. The backend connects to the configured database before opening its HTTP listener.

From `backend/`, after configuring the development database and seed variables:

```powershell
node seed.js
```

The seed script hashes passwords with bcrypt (cost 12), upserts one Student User and one Teacher User by identifier, and upserts the linked Student profile. Re-running it updates those demo accounts, including their password hashes; use it only against the intended development database. It does not populate sample classes, quizzes, materials, payments, results, or notifications. Unique indexes and validators are declared in the models; their deployment should be verified for the target database.

## Start the backend

In a backend terminal:

```powershell
cd E:\EduTrack\backend
npm start
```

For automatic development restarts, use `npm run dev` instead. Check `http://localhost:5000/api/health`; expect HTTP 200 with `status: "ok"` and `database: "connected"`. The health route can return 200 with `database: "disconnected"`, so inspect the body as well as the HTTP status.

## Install and start the mobile application

In a separate terminal:

```powershell
cd E:\EduTrack\mobile
npm ci
```

Create or update your local, ignored `mobile/.env` to define **only the public API address** needed by the mobile app:

```dotenv
EXPO_PUBLIC_API_URL=http://<development-computer-LAN-IP>:5000
```

Replace the placeholder with your development computer's reachable LAN address, without a trailing slash. A physical Android device must normally share the network with the computer; its `localhost` is the device itself. For the standard Android Studio emulator, the host computer is commonly reachable at `http://10.0.2.2:5000`. Allow the configured backend port through the development firewall as needed. An Expo tunnel does not automatically expose the backend API.

```powershell
npm start
```

Open the project in a compatible Expo Go/development client. With an Android emulator configured, `npm run android` starts Expo for Android. Restart Expo after changing the public API URL. iOS/web package scripts exist, but Sprint 1 evaluation evidence focuses on Android; SecureStore-dependent flows are not claimed as browser-tested.

## Demo login and session walkthrough

1. Confirm the backend health response and that the configured demo accounts have been seeded.
2. In the mobile app choose **Student**, then use the registration number or email configured by `SEED_STUDENT_REG` / `SEED_STUDENT_EMAIL`, with the privately configured Student password.
3. Log out, choose **Teacher / Lecturer**, and use the email configured by `SEED_TEACHER_EMAIL`, with the privately configured Teacher password.
4. As Teacher, choose **Load Teacher Data** to retrieve the authenticated profile from the protected endpoint.
5. Restart the app to check saved-session verification, and use logout to check secure deletion. Repeat invalid-credential, expired-session, and offline/retry scenarios during Android acceptance testing.

There is no universal committed demo password. Obtain test values from the local development environment or the team privately. Do not paste passwords or JWTs into screenshots, documentation, or commits.

## Implemented API and testing

Default development base URL: `http://localhost:5000`.

| Method | Endpoint | Access and purpose |
|---|---|---|
| GET | `/api/health` | Public application/database status |
| POST | `/api/auth/login` | Student/Teacher credentials; returns JWT and public User fields |
| GET | `/api/auth/me` | Bearer JWT; validates an existing Student/Teacher account |
| GET | `/api/teacher/dashboard` | Bearer JWT with Teacher role; returns basic account details |

Login accepts JSON `{ "role": "student or teacher", "identifier": "local test identifier", "password": "local test password" }`; substitute one supported role and local credentials. Protected requests send `Authorization: Bearer <JWT>`. Successful User payloads contain `id`, `name`, `role`, and `identifier`, with no password hash. See the specification for exact request formats and 400/401/403/404/500 behavior.

- **VS Code:** open [EduTrack.http](docs/api-tests/EduTrack.http), follow its [README](docs/api-tests/README.md), configure the separate ignored `docs/api-tests/.env`, and use **Send Request**. Named login responses supply tokens to protected requests automatically.
- **Postman:** import the [authentication collection](docs/postman/EduTrack-Authentication.postman_collection.json), configure local variables, and follow the [collection README](docs/postman/README.md). A full run logs in Teacher last; validate Student separately after Student login.
- Keep request histories and response previews private: login responses intentionally contain JWTs. Clear runtime secrets before exporting a used collection.

Available code and Expo checks, run from their respective folders:

```powershell
# From backend/
node --check server.js
node --check seed.js

# From mobile/
npx expo-doctor

# From repository root
git diff --check
```

`backend/package.json` currently has a placeholder `npm test` script that exits unsuccessfully. A repeatable automated regression suite, lint configuration, and TypeScript checking setup are not yet provided. REST Client requests are for manual execution; Postman requests contain assertions.

## Documentation and Sprint 1 testing evidence

| Deliverable | Link |
|---|---|
| REST API specification (EDU-58) | [API-SPEC.md](docs/API-SPEC.md) |
| REST Client requests and setup (EDU-22) | [Requests](docs/api-tests/EduTrack.http), [instructions](docs/api-tests/README.md) |
| Recorded live API results | [TEST-RESULTS.md](docs/api-tests/TEST-RESULTS.md) |
| Postman collection | [Collection](docs/postman/EduTrack-Authentication.postman_collection.json), [instructions](docs/postman/README.md) |
| UML class diagram (EDU-57) | [Explanation](docs/diagrams/CLASS-DIAGRAM.md), [SVG](docs/diagrams/CLASS-DIAGRAM.svg), [Mermaid](docs/diagrams/CLASS-DIAGRAM.mmd) |
| Login/session sequence diagram (EDU-57) | [Explanation](docs/diagrams/LOGIN-SEQUENCE.md), [SVG](docs/diagrams/LOGIN-SEQUENCE.svg), [Mermaid](docs/diagrams/LOGIN-SEQUENCE.mmd) |

The committed report records **9/9 real API tests passing on 8 November 2026**: health, both logins, both current-user validations, Teacher dashboard access, Student rejection from that endpoint, missing JWT, and invalid password. The subsequent final audit executed **10 live requests successfully**, adding invalid-JWT coverage; that extra run was reported in the audit discussion, not added to the committed nine-test report.

The final audit also reported Expo Doctor **20/20**, JavaScript/JSX syntax checks, model loading, documentation artifact checks, and targeted secret scans passing. These are historical results, not a claim that tests run automatically on every checkout. Android Student/Teacher login was reported working; full restoration, logout, expiry, and retry acceptance evidence remains to be recorded. No new runtime test run is implied by this README update.

## Member contributions and Git traceability

The following attribution follows repository commit authors and merged PR history. Merge authorship records integration activity and does not replace the original feature author's credit.

| Member | Evidence-backed contributions | Example commits / integration |
|---|---|---|
| Member 1 — `sadeepa-div` | Expo welcome/login UI; role-based dashboard protection; SecureStore login/logout; Teacher API integration; authenticated current-user endpoint; startup restoration and expired-session handling; API collections/tests/results; API specification and UML diagrams | `ed8c356`, `52cf187`, `8a26970`, `bdf81d4`, `a5f1cd2`, `1baba64`, `81feb6d`, `482d104`, `97e5161`, `363e76c`, `5f2bcd7`, `9e1eae5`; [PR #6](https://github.com/tharushikadilrukshi111-hash/EduTrack/pull/6) merged into dev |
| Member 2 — `Tharu` / `Tharushika Dilrukshi` | Initial MongoDB login and Student/Teacher authentication; JWT/role middleware and protected Teacher endpoint; seed validation; database schemas, indexes, validators and linked Student seeding | `2214184`, `99513bf`, `caac824`, `fb04608`, `413726f`; [PR #3](https://github.com/tharushikadilrukshi111-hash/EduTrack/pull/3) and [PR #5](https://github.com/tharushikadilrukshi111-hash/EduTrack/pull/5) merged into dev |

Database work also entered main through [PR #4](https://github.com/tharushikadilrukshi111-hash/EduTrack/pull/4). At the README preparation baseline `66f2776`, both members' completed Sprint 1 work is integrated in `dev`; `main` does not yet contain the complete mobile/authentication/documentation integration. Use the integrated dev revision for evaluation. Preserve original commit history when presenting individual contributions.

## Planned features and known limitations

Future work includes Parent/Admin authentication, registration/activation, password recovery, full role dashboards, class/enrollment management, learning materials, quizzes, results/progress, payments, notifications, automated regression testing, and deployment hardening. These are planned features, not completed Sprint 1 deliverables.

Current limitations:

- The Teacher API returns a profile, not a full teaching dashboard; there is no protected Student dashboard endpoint yet.
- JWT expiry is two hours. There is no refresh endpoint, server-side logout/revocation endpoint, or token denylist. Local logout does not invalidate copies of a token.
- Teacher authorization checks the verified JWT role claim; a subsequent database role change is not immediately reflected by that claim. `/api/auth/me` checks the current database role and rejects deleted/unsupported accounts.
- Mongoose references do not enforce target existence, role restrictions, or cascade deletion. Schema models do not imply implemented feature APIs. See the class diagram's constraints and index notes.
- Startup/Teacher requests include stale-response guards, but the app is not claimed to have comprehensive concurrency or end-to-end test coverage.
- The existing login catch uses a generic connection error for network, JSON-parsing, and SecureStore write failures.
- Framework-generated errors are not guaranteed to use the application's JSON error format. Production deployment hardening and broader security/performance evaluation remain future work.

Repository: [EduTrack on GitHub](https://github.com/tharushikadilrukshi111-hash/EduTrack).
