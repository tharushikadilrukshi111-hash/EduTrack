# EduTrack API tests in VS Code

1. Install **REST Client** by Huachao Mao (`humao.rest-client`). Start the backend with MongoDB connected and existing seeded Student/Teacher accounts.
2. Copy this directory's `.env.example` to `docs/api-tests/.env` only if that file does not already exist. Fill in your local test account values there. This is separate from the backend/mobile environment files. Student identifiers may be registration numbers or emails; Teacher identifiers are email addresses. Quote values containing `#` or spaces as needed for dotenv syntax.
3. The repository's existing `.gitignore` ignores `.env` files in every directory. Verify with `git check-ignore docs/api-tests/.env`. Never force-add the local file. No Git ignore changes are required.
4. Open `EduTrack.http`. Keep `@baseUrl = http://localhost:5000`, or edit its port to match your backend. Choose **HTTP** language mode if **Send Request** links do not appear.
5. Click **Send Request** above Health. Expect HTTP 200 with `status: "ok"` and `database: "connected"`.
6. Send Student login, confirm HTTP 200 and `user.role: "student"`, then send Validate Student. Expect the same user ID, name, identifier and role.
7. Send Teacher login, confirm HTTP 200 and `user.role: "teacher"`, then send Validate Teacher and Protected Teacher API. Both should return that Teacher account.

Login responses are named `studentLogin` and `teacherLogin`. Protected requests automatically extract the corresponding response's token using `{{studentLogin.response.body.$.token}}` or `{{teacherLogin.response.body.$.token}}`. Tokens remain runtime response values: do not paste them into this file or persist them in configuration. Re-run the corresponding login after a token expires or VS Code loses the cached response. Always confirm the latest login succeeded before sending protected requests.

REST Client reads `{{$dotenv VARIABLE}}` from the `.env` beside the `.http` file. Named response references require sending the named request first. These are supported by the [REST Client documentation](https://github.com/Huachao/vscode-restclient#variables).

Responses are shown in VS Code for manual inspection; this file does not run automated assertions. `/api/auth/me` and the Teacher dashboard should expose only `user.id`, `user.name`, `user.role`, and `user.identifier`, never password hashes. Missing/invalid JWTs should return 401; a Student JWT on the Teacher endpoint should return 403.

REST Client request history and response previews can contain credentials/tokens. Do not share them or save response examples into the repository. Local credentials are Git-ignored, not encrypted. The existing Postman collection is unchanged.
