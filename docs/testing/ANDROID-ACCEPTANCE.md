# EduTrack Sprint 1 Android Acceptance Test Report

## Report identification

| Field | Value |
|---|---|
| Scope | Student/Teacher authentication, protected navigation and session lifecycle |
| Related Jira tasks | EDU-21; supporting login/API evidence from EDU-22 |
| Report prepared | 8 November 2026 (Asia/Colombo) |
| Source baseline | `dev` at `9d779f4`; confirmed equal to fetched `origin/dev` before branching |
| Documentation branch | `docs/android-acceptance-tests` |
| Physical Android execution date/time | To be completed |
| Tester | To be completed |
| Device manufacturer and model | To be completed |
| Android version / security patch | To be completed |
| Expo Go or development build / version | To be completed |
| App revision actually tested | To be completed |
| Backend revision and environment label | To be completed; omit private connection details |
| Network conditions | To be completed |
| Evidence location / reviewer | To be completed; use redacted artifacts |

## Evidence policy and current outcome

**Physical Android acceptance is NOT VERIFIED for all nine cases below.** This report prepares executable steps; it does not claim that new device tests were performed. Earlier conversation records state that Student and Teacher login worked on Android, but provide no device model, physical-versus-emulator confirmation, execution date, or reproducible evidence. That statement is retained as supporting history and is insufficient to mark physical-device acceptance PASS.

The committed [live API report](../api-tests/TEST-RESULTS.md) records nine backend tests passing on 8 November 2026. Those real HTTP checks support API behavior, not Android storage, screen rendering, lifecycle, or navigation. Source inspection establishes expected behavior, not a device result. Prior mocked checks are not substituted for physical-device execution.

| Status | Meaning |
|---|---|
| PASS | Executed on the identified physical Android device; all expected outcomes observed and evidence recorded |
| FAIL | Executed on that device; at least one expected outcome was not met; record a defect |
| NOT VERIFIED | Not executed with adequate physical-device evidence, or a prerequisite prevented execution |

When executing, replace each actual-result placeholder, record the date and evidence, and update its status. Never record passwords, JWTs, signing secrets, or private database URIs.

## Preconditions

- Record device/build details above and use a reachable development backend with MongoDB connected.
- Configure the existing local mobile API URL for the physical device's network; the device's `localhost` does not address the development computer.
- Use privately configured, existing seeded Student and Teacher accounts. Do not copy credentials into this report.
- Begin each independent login test logged out. For restoration tests, preserve app storage and do not uninstall or clear app data.
- Record failures and retry behavior as observed; do not change source, schemas, or environment files to force a PASS.
- Use screen recordings or screenshots with personal data redacted. Prove storage behavior through observable restart behavior or an approved secure inspection, never by displaying a token.

## Test summary

| ID | Test case | Physical Android status | Supporting recorded evidence |
|---|---|---|---|
| AAT-01 | Student login | NOT VERIFIED | Student API login returned 200; Android login previously reported without device metadata |
| AAT-02 | Teacher login | NOT VERIFIED | Teacher API login returned 200; Android login previously reported without device metadata |
| AAT-03 | Student session restoration | NOT VERIFIED | Student `/api/auth/me` returned 200; no physical restart evidence |
| AAT-04 | Teacher session restoration | NOT VERIFIED | Teacher `/api/auth/me` returned 200; no physical restart evidence |
| AAT-05 | Secure logout | NOT VERIFIED | SecureStore deletion exists in source; no device deletion/restart evidence |
| AAT-06 | Teacher-only dashboard access | NOT VERIFIED | Teacher API returned 200; Student API access returned 403 |
| AAT-07 | Invalid password handling | NOT VERIFIED | Invalid Student password returned 401 in live API tests |
| AAT-08 | Backend network failure and retry | NOT VERIFIED | Error/retry paths exist in source; no physical network-failure evidence |
| AAT-09 | Expired JWT handling | NOT VERIFIED | Expiry/401 paths exist in source; missing-token API 401 is not expiry evidence |

## AAT-01 — Student login

**Steps**

1. Start the logged-out app and choose Get started, then Student.
2. Enter the configured Student registration number or email and its correct password.
3. Submit and observe the loading state and destination.

**Expected:** Authentication succeeds; the Student dashboard placeholder and correct welcome name appear. Teacher-only Load Teacher Data is absent. The password state clears and JWT storage completes before authenticated navigation. No token is displayed.

**Actual:** Physical-device execution not recorded. Historical backend evidence: Student login HTTP 200 with token and Student user fields. Earlier Android login statement lacks physical-device metadata.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-02 — Teacher login

**Steps**

1. From a logged-out app choose Teacher / Lecturer.
2. Enter the configured Teacher email and correct password; submit.
3. Observe the destination and available actions.

**Expected:** Teacher dashboard placeholder and correct welcome name appear after successful secure token storage. Load Teacher Data is available. The returned role matches Teacher and the password state clears.

**Actual:** Physical-device execution not recorded. Historical backend evidence: Teacher login HTTP 200 with token and Teacher user fields. Earlier Android login statement lacks physical-device metadata.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-03 — Student session restoration

**Steps**

1. Complete Student login, then close/force-stop the app without logging out or clearing its data.
2. Reopen it while the backend is reachable and the two-hour token remains valid.
3. Observe session checking and the final screen.

**Expected:** A checking-session indicator appears while `/api/auth/me` validates the saved JWT. Only a successful supported-user response restores Student role and dashboard. Teacher-only actions remain absent. A later restart after logout must not restore this session.

**Actual:** Physical restart not recorded. Historical backend evidence: Student `/api/auth/me` HTTP 200 and matching account/role; this does not verify device persistence.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-04 — Teacher session restoration

**Steps**

1. Complete Teacher login and close/force-stop the app without logout or storage clearing.
2. Reopen with a valid token and reachable backend.
3. After restoration, select Load Teacher Data.

**Expected:** Session verification precedes Teacher dashboard navigation. The Teacher role and matching profile are restored; the protected data request succeeds. No token is rendered or logged by the app.

**Actual:** Physical restart not recorded. Historical backend evidence: Teacher current-user and protected dashboard requests returned HTTP 200.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-05 — Secure logout

**Steps**

1. Log in as Student and select Log out.
2. Confirm Welcome is shown, then force-stop/reopen without clearing app data.
3. Confirm no automatic authenticated session returns. Repeat with Teacher.
4. If a controlled SecureStore deletion-failure scenario is available without modifying application code, record its setup and result separately; otherwise mark that subcase NOT VERIFIED.

**Expected:** Successful deletion precedes user/password clearing and Welcome navigation; restart remains logged out. On deletion failure, an error is shown and the app does not pretend authenticated state was cleared successfully. Late Teacher-data responses must not reopen a dashboard after logout.

**Actual:** No physical logout/restart or deletion-failure evidence recorded. Source uses `deleteItemAsync` before clearing user state; source order alone is not runtime proof.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-06 — Teacher-only dashboard access

**Steps**

1. Log in as Teacher and select Load Teacher Data; observe loading and returned profile.
2. Log out and sign in as Student; inspect the Student dashboard.
3. Repeat after a Student restart/restoration.
4. Cross-reference the existing backend negative-access test rather than inserting a Student token into tracked files.

**Expected:** Teacher loads their own name, role and identifier. Students have no Teacher data button and remain on their Student dashboard. Backend independently rejects Student access to the Teacher endpoint with 403. A delayed response from an old session must not affect a newer login.

**Actual:** Physical UI and delayed-response checks not recorded. Existing live API report confirms Teacher dashboard 200 and Student dashboard access 403.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-07 — Invalid password handling

**Steps**

1. Choose Student and enter a known account identifier with a deliberately incorrect password of at least eight characters, so the request reaches the backend.
2. Submit; observe the error and screen. Repeat for Teacher.
3. Correct the password and retry to confirm recovery. Do not save attempted passwords here.

**Expected:** Backend rejection displays a sign-in error; no authenticated navigation or new token storage occurs. Loading ends and retry is possible. Passwords shorter than eight characters are rejected locally, which is a separate validation path.

**Actual:** Physical UI checks not recorded. Existing backend invalid-Student-password test returned HTTP 401. Teacher invalid-password acceptance is not evidenced by that test.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-08 — Backend network failure and retry

**Steps**

1. With a valid saved session, make the development backend unreachable in a controlled manner without changing application configuration; record the method.
2. Restart the app. Observe the verification indicator, then the error/retry screen. Restore connectivity and select Retry session check.
3. As Teacher, repeat the outage while selecting Load Teacher Data, restore connectivity, and select it again.
4. From a logged-out app, also submit valid login details during the outage, then retry after connectivity is restored.

**Expected:** Startup does not trust the token while verification fails. It preserves the saved token and offers Retry session check / Continue to Welcome; a successful retry restores the correct account. Teacher data errors preserve the session and allow retry. Login connection errors leave the user on login with loading cleared. Startup fetch has an abort timer; no fixed login/Teacher-request timeout is claimed.

**Actual:** No physical outage/retry evidence recorded. Existing code has these handling paths; successful online API tests do not verify them.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## AAT-09 — Expired JWT handling

**Steps**

1. Log in as Teacher and record the approximate login time, without recording the token.
2. Allow more than the configured two-hour lifetime to pass while keeping the dashboard session available. Do not shorten expiry or edit credentials/source for this test.
3. With the backend reachable, select Load Teacher Data.
4. Confirm the expired-session alert and Welcome screen, then restart and verify no restored session.
5. Separately repeat valid login and expiry for Student and Teacher startup restoration; reopen after expiry without first loading Teacher data. Record each subcase.

**Expected:** Teacher API 401 causes secure token deletion, user/password/Teacher-data clearing, Welcome navigation and a clear session-expired alert. Startup restoration 401 deletes the saved token and shows Welcome; the startup path does not promise the Teacher-specific alert. Deletion failure shows an error instead of successful logout. Network/server failures preserve the token; 403 shows access denied without deletion.

**Actual:** No physical expiry, deletion-failure, or expired-startup evidence recorded. Missing-token 401 and mocked expiry handling are not proof of this physical-device scenario.

**Status:** NOT VERIFIED. **Execution date / evidence / defect:** To be completed.

## Execution results and sign-off

| Outcome | Current count |
|---|---:|
| PASS | 0 |
| FAIL | 0 |
| NOT VERIFIED | 9 |

No observed device failures are asserted; all nine physical Android acceptance cases await adequate execution evidence. The completed API tests remain separate supporting evidence. Passing a case requires all applicable steps, or an explicit reviewer-approved scope decision for unavailable failure-injection subcases.

- Outstanding defects and retest references: To be completed.
- Tester signature/date: To be completed.
- Reviewer signature/date: To be completed.
- Sprint 1 Android acceptance decision: Pending execution and review.

Related references: [API specification](../API-SPEC.md), [API test instructions](../api-tests/README.md), [login sequence](../diagrams/LOGIN-SEQUENCE.md), and [project setup](../../README.md).
