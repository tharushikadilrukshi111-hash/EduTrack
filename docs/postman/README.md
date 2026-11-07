# EduTrack authentication collection

1. Start the local backend and confirm it can connect to MongoDB. Existing seeded Student and Teacher accounts are required; this collection does not create accounts.
2. In Postman, choose **Import** and select `EduTrack-Authentication.postman_collection.json` (Collection v2.1).
3. Open the collection's **Variables**. Set local values for `studentIdentifier`, `studentPassword`, `teacherIdentifier`, and `teacherPassword` using your development test accounts. Student identifiers can be a registration number or email; Teacher identifiers are email addresses. Do not copy secrets into source control.
4. Keep `baseUrl` as `http://localhost:5000` or change it to your backend's base URL without a trailing slash. Avoid environment/global variables with the same names overriding collection values.
5. Run all five requests in order with Collection Runner. Each login checks its role and captures its JWT in the `token` collection variable. Teacher login runs last, so `/api/auth/me` and the Teacher dashboard use the Teacher JWT. The tests check status, user fields, account identity, role, and JWT presence/shape; backend validation verifies the token.
6. To validate a Student session separately, send **Login — Student**, then **Current user**. To access the Teacher dashboard again, send **Login — Teacher** first. A Student token must not grant Teacher dashboard access (the backend returns 403; the dashboard's success tests will intentionally fail).

The exported file contains no passwords, identifiers, or tokens. Postman scripts do not log credentials or tokens, but runtime requests and responses contain authentication data. Keep runs private. Before exporting or sharing a used collection, clear `studentPassword`, `teacherPassword`, `token`, `tokenRole`, and `userId`, and remove any personal identifiers or saved response examples. Avoid saving secrets to shared/synced values.

Tests can be viewed in each request's post-response scripts. A failed login clears the previous runtime token to avoid accidentally testing an older session. Check backend availability, database connection, and local account values if tests fail. This collection covers successful authentication; it does not automatically run missing/invalid-token cases.
