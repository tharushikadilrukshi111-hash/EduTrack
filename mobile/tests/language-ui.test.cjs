// Mocked JS component assertions; no native rendering or physical-device claims.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const resolve = (name) => require.resolve(name, { paths: [root] });
const babel = require(resolve("@babel/core"));
const plugins = ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"].map(resolve);
const tick = () => new Promise((done) => setImmediate(done));

function environment(fileSystem) {
  const slots = [], effects = [], requests = [], writes = [], deletes = [], alerts = [];
  let token = null, readError = false, deleteError = false;
  let hardwareBack = null;
  let cursor = 0, pending = [], locale = "en", savingResult = true;
  let save = async () => savingResult;
  let response = { ok: false, json: async () => ({ message: "Backend message" }) };
  const React = {
    createElement: (type, props, ...children) => {
      const merged = { ...props, ...(children.length ? { children } : {}) };
      if (["LocalizedText", "LocalizedTextInput", "SinhalaText", "SinhalaTextInput", "StudentDashboard"].includes(type.name)) return type(merged);
      return { type, props: merged };
    },
    createContext: (value) => ({ value, Provider: "Provider" }),
    useContext: (context) => context.value,
    forwardRef: (fn) => fn,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], (v) => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || deps.some((value, j) => value !== previous.deps[j])) {
        pending.push(() => {
          previous?.cleanup?.();
          const cleanup = fn();
          slots[i] = { deps, cleanup };
          return cleanup;
        });
      }
    },
  };
  const flatten = (s) => Array.isArray(s) ? Object.assign({}, ...s.map(flatten)) : s || {};
  const native = new Proxy({
    StyleSheet: { create: (s) => s, flatten }, Platform: { OS: "android" }, Alert: { alert: (...args) => alerts.push(args) },
    BackHandler: { addEventListener: (_, callback) => {
      hardwareBack = callback;
      return { remove() { if (hardwareBack === callback) hardwareBack = null; } };
    } },
  }, {
    get: (object, key) => key in object ? object[key] : key,
  });
  const cache = {};
  const language = {
    LanguageProvider: "LanguageProvider",
    useLanguage: () => ({
      language: locale,
      t: (key, params) => load("localization/i18n.js").createI18n(locale).t(key, params),
      setLanguage: (code) => { locale = code; return save(); },
    }),
  };
  function load(file) {
    file = path.resolve(root, file);
    if (cache[file]) return cache[file].exports;
    const module = { exports: {} }; cache[file] = module;
    const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), { plugins, configFile: false, babelrc: false });
    vm.runInNewContext(code, {
      module, exports: module.exports, AbortController, setTimeout, clearTimeout,
      process: { env: { EXPO_PUBLIC_API_URL: "http://test.invalid" } },
      fetch: async (url, options) => {
        requests.push({ url, options });
        return typeof response === "function" ? response(url, options) : response;
      },
      require(name) {
        if (name === "react") return React;
        if (name === "react-native") return native;
        if (name === "expo-file-system" && fileSystem) return fileSystem;
        if (name === "expo-font") return { useFonts: () => [false, null] };
        if (name.endsWith(".ttf")) return name;
        if (name.endsWith("/context/LanguageContext")) return language;
        if (name === "expo-secure-store") return {
          getItemAsync: async () => { if (readError) throw Error("test"); return token; },
          setItemAsync: async (...args) => { writes.push(args); token = args[1]; },
          deleteItemAsync: async (key) => { deletes.push(key); if (deleteError) throw Error("test"); token = null; },
        };
        return name.startsWith(".") ? load(path.resolve(path.dirname(file), `${name}.js`)) : require(resolve(name));
      },
    }, { filename: file });
    return module.exports;
  }
  return {
    load, requests, writes, deletes, alerts,
    setToken: (value) => { token = value; },
    setReadError: (value) => { readError = value; },
    setDeleteError: (value) => { deleteError = value; },
    setLocale: (next) => { locale = next; },
    setSave: (fn) => { save = fn; },
    setResponse: (value) => { response = value; },
    hardwareBack: () => hardwareBack?.(),
    render(Component) {
      cursor = 0; pending = [];
      const tree = Component();
      pending.forEach((effect) => effects.push(effect()));
      return tree;
    },
    unmount() { effects.forEach((cleanup) => cleanup?.()); },
  };
}

function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!node || typeof node !== "object") return [];
  return [node, ...all(node.props?.children)];
}
function text(tree) {
  function strings(node) {
    if (Array.isArray(node)) return node.flatMap(strings);
    if (typeof node === "string") return [node];
    return node?.props ? strings(node.props.children) : [];
  }
  return strings(tree).join(" ");
}
function button(tree, title) {
  const node = all(tree).find((n) => n.props.title === title)
    || all(tree).find((n) => ["TouchableOpacity", "Pressable"].includes(n.type) && text(n) === title);
  assert.ok(node, title); return node;
}
async function loginScreen(env, role = "student") {
  const wrapper = env.load("App.js").default();
  assert.equal(wrapper.type, "LanguageProvider");
  const AppContent = wrapper.props.children[0].props.children[0].type;
  env.render(AppContent); await tick();
  let tree = env.render(AppContent);
  button(tree, "Get started").props.onPress();
  tree = env.render(AppContent);
  if (role === "student") button(tree, "I'm a student").props.onPress();
  else {
    const label = { teacher: "Teacher / Lecturer", parent: "Parent / Guardian", admin: "Administrator access" }[role];
    const option = all(tree).find((n) => n.props.onPress && text(n) === label)
      || all(tree).find((n) => n.type === "TouchableOpacity" && text(n).includes(label));
    assert.ok(option); option.props.onPress();
  }
  return AppContent;
}

test("switcher accessible selection, immediate update, rapid-tap guard, failure and retry", async () => {
  const env = environment(), Switcher = env.load("components/LanguageSwitcher.js").default;
  let finish; env.setSave(() => new Promise((done) => { finish = done; }));
  let tree = env.render(Switcher), options = all(tree).filter((n) => n.type === "Pressable");
  assert.equal(options.length, 2);
  assert.equal(options[0].props.accessibilityState.selected, true);
  assert.equal(options[1].props.accessibilityRole, "button");
  const first = options[1].props.onPress();
  await options[0].props.onPress(); // Old callback cannot bypass the synchronous guard.
  tree = env.render(Switcher); options = all(tree).filter((n) => n.type === "Pressable");
  assert.equal(options[1].props.accessibilityState.selected, true);
  assert.ok(options.every((n) => n.props.disabled));
  finish(false); await first;
  tree = env.render(Switcher);
  assert.ok(all(tree).some((n) => n.props.accessibilityLiveRegion === "polite"));
  env.setSave(async () => true);
  await all(tree).find((n) => n.type === "Pressable").props.onPress();
  tree = env.render(Switcher);
  assert.equal(all(tree).some((n) => n.props.accessibilityLiveRegion === "polite"), false);
  assert.equal(all(tree).find((n) => n.type === "Pressable").props.accessibilityState.selected, true);
});

test("Welcome and role selection update in place in English and Sinhala", async () => {
  const env = environment(), wrapper = env.load("App.js").default(), AppContent = wrapper.props.children[0].props.children[0].type;
  env.render(AppContent); await tick();
  let tree = env.render(AppContent); assert.match(text(tree), /Learn with confidence/);
  env.setLocale("si"); tree = env.render(AppContent);
  const translator = env.load("localization/i18n.js").createI18n("si");
  assert.ok(text(tree).includes(translator.t("welcome.heading")));
  button(tree, translator.t("welcome.getStarted")).props.onPress();
  tree = env.render(AppContent);
  assert.ok(text(tree).includes(translator.t("roles.teacherDescription")));
  env.setLocale("en"); tree = env.render(AppContent);
  assert.match(text(tree), /Teach, assess and support your classes/);
  assert.equal(env.requests.length, 0);
});

test("Login switching preserves inputs, role, password visibility and local validation keys", async () => {
  const env = environment(), AppContent = await loginScreen(env);
  let tree = env.render(AppContent);
  await button(tree, "Sign in").props.onPress();
  tree = env.render(AppContent); assert.match(text(tree), /Please enter your login details/);
  env.setLocale("si"); tree = env.render(AppContent);
  const tr = env.load("localization/i18n.js").createI18n("si");
  assert.ok(text(tree).includes(tr.t("auth.requiredFields")));
  let inputs = all(tree).filter((n) => n.type === "TextInput");
  inputs[0].props.onChangeText("ET-TEST"); inputs[1].props.onChangeText("test-password");
  env.setLocale("en"); tree = env.render(AppContent);
  inputs = all(tree).filter((n) => n.type === "TextInput");
  assert.equal(inputs[0].props.value, "ET-TEST"); assert.equal(inputs[1].props.value, "test-password");
  assert.equal(inputs[1].props.secureTextEntry, true);
  all(tree).find((n) => n.props.onPress && text(n) === "Show password").props.onPress();
  tree = env.render(AppContent); assert.equal(all(tree).filter((n) => n.type === "TextInput")[1].props.secureTextEntry, false);
  assert.equal(env.requests.length, 0);
  await button(tree, "Sign in").props.onPress(); tree = env.render(AppContent);
  assert.equal(JSON.parse(env.requests[0].options.body).role, "student");
  assert.match(text(tree), /Backend message/);
  env.setLocale("si"); tree = env.render(AppContent); assert.match(text(tree), /Backend message/);
});

test("all role selections keep internal codes; Teacher login/logout retain token-only operations", async () => {
  for (const role of ["teacher", "parent", "admin"]) {
    const env = environment(), AppContent = await loginScreen(env, role);
    let tree = env.render(AppContent), inputs = all(tree).filter((n) => n.type === "TextInput");
    inputs[0].props.onChangeText("teacher@example.test"); inputs[1].props.onChangeText("test-password");
    env.setLocale("si"); tree = env.render(AppContent);
    const tr = env.load("localization/i18n.js").createI18n("si");
    assert.ok(text(tree).includes(tr.t(`login.${role}Title`)));
    env.setResponse({ ok: true, json: async () => ({ token: "test-token", user: { id: "test-user", role, name: "Test", identifier: "test" } }) });
    await button(tree, tr.t("login.signIn")).props.onPress();
    tree = env.render(AppContent);
    if (role === "teacher") {
      assert.equal(JSON.parse(env.requests[0].options.body).role, "teacher");
      assert.equal(env.writes[0][0], "edutrack_token");
      assert.ok(text(tree).includes(tr.t("dashboard.teacher")));
      await button(tree, tr.t("dashboard.logout")).props.onPress();
      assert.deepEqual(env.deletes, ["edutrack_token"]);
      assert.ok(text(env.render(AppContent)).includes(tr.t("welcome.heading")));
    } else {
      assert.equal(env.requests.length, 0);
      assert.ok(text(tree).includes(tr.t("auth.roleUnavailable")));
    }
  }
});

async function authenticatedDashboard(env, role, id = "test-user") {
  const AppContent = await loginScreen(env, role);
  let tree = env.render(AppContent), inputs = all(tree).filter((n) => n.type === "TextInput");
  inputs[0].props.onChangeText(role === "student" ? "ET-TEST" : "teacher@example.test");
  inputs[1].props.onChangeText("test-password");
  const user = { id, role, name: "Untranslated Name", identifier: "ORIGINAL-ID" };
  env.setResponse({ ok: true, json: async () => ({ token: "test-token", user }) });
  tree = env.render(AppContent); await button(tree, "Sign in").props.onPress();
  return { AppContent, user };
}

test("both dashboards translate immediately without navigation, logout, or extra requests", async () => {
  for (const role of ["student", "teacher"]) {
    const env = environment(), { AppContent, user } = await authenticatedDashboard(env, role);
    const count = env.requests.length;
    for (const locale of ["en", "si", "en"]) {
      env.setLocale(locale);
      const tr = env.load("localization/i18n.js").createI18n(locale), tree = env.render(AppContent);
      for (const key of [`dashboard.${role}`, "dashboard.loginSuccessful", "dashboard.comingSoon"]) assert.ok(text(tree).includes(tr.t(key)));
      assert.ok(text(tree).includes(tr.t("dashboard.welcome", { name: user.name })));
      assert.ok(all(tree).some((n) => n.type.name === "LanguageSwitcher"));
      assert.ok(button(tree, tr.t("dashboard.logout")));
      const hasTeacherAction = all(tree).some((n) => n.props.title === tr.t("dashboard.loadTeacherData"));
      assert.equal(hasTeacherAction, role === "teacher");
      assert.equal(env.requests.length, count); assert.equal(env.deletes.length, 0);
    }
  }
});

test("loaded Teacher values survive language changes; only labels translate", async () => {
  const env = environment(), { AppContent, user } = await authenticatedDashboard(env, "teacher");
  const payload = { ...user, name: "Teacher Original Name", identifier: "teacher@example.test" };
  env.setResponse({ ok: true, json: async () => ({ user: payload }) });
  await button(env.render(AppContent), "Load Teacher Data").props.onPress();
  const count = env.requests.length;
  assert.ok(env.requests.at(-1).url.endsWith("/api/teacher/dashboard"));
  assert.equal(env.requests.at(-1).options.headers.Authorization, "Bearer test-token");
  for (const locale of ["en", "si", "en"]) {
    env.setLocale(locale); const tree = env.render(AppContent), tr = env.load("localization/i18n.js").createI18n(locale);
    assert.ok(text(tree).includes(payload.name));
    const joinText = (node) => typeof node === "string" ? node
      : Array.isArray(node) ? node.map(joinText).join("") : joinText(node?.props?.children || []);
    const labels = all(tree).filter((n) => n.type === "Text").map(joinText);
    assert.ok(labels.includes(`${tr.t("dashboard.roleLabel")}: teacher`));
    assert.ok(labels.includes(`${tr.t("dashboard.identifierLabel")}: ${payload.identifier}`));
    assert.equal(env.requests.length, count);
  }
});

test("Teacher loading state translates during the same pending request", async () => {
  const env = environment(), { AppContent, user } = await authenticatedDashboard(env, "teacher");
  let finish;
  env.setResponse(() => new Promise((resolve) => { finish = resolve; }));
  const request = button(env.render(AppContent), "Load Teacher Data").props.onPress();
  await tick(); env.setLocale("si");
  const tr = env.load("localization/i18n.js").createI18n("si"), tree = env.render(AppContent);
  assert.equal(button(tree, tr.t("dashboard.loadTeacherData")).props.disabled, true);
  assert.ok(text(tree).includes(tr.t("common.loading")));
  assert.equal(env.requests.length, 2);
  finish({ ok: true, json: async () => ({ user }) }); await request;
  assert.equal(button(env.render(AppContent), tr.t("dashboard.loadTeacherData")).props.disabled, false);
});

test("Teacher local errors are reactive; arbitrary backend errors remain verbatim", async () => {
  const cases = [
    [{ status: 403 }, "auth.teacherAccessDenied"],
    [{ ok: true, json: async () => ({ user: { id: "different", role: "teacher" } }) }, "auth.unexpectedTeacherData"],
    [{ ok: false, json: async () => ({}) }, "auth.teacherDataFailure"],
    [() => { throw Error("network"); }, "auth.teacherConnectionFailure"],
  ];
  for (const [reply, key] of cases) {
    const env = environment(), { AppContent } = await authenticatedDashboard(env, "teacher");
    env.setResponse(reply);
    await button(env.render(AppContent), "Load Teacher Data").props.onPress();
    for (const locale of ["en", "si"]) {
      env.setLocale(locale);
      assert.ok(text(env.render(AppContent)).includes(env.load("localization/i18n.js").createI18n(locale).t(key)));
    }
  }
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "teacher");
  env.setResponse({ ok: false, json: async () => ({ message: "Verbatim server message" }) });
  await button(env.render(AppContent), "Load Teacher Data").props.onPress();
  env.setLocale("si"); assert.match(text(env.render(AppContent)), /Verbatim server message/);
});

test("session checking/error/retry screens translate without modifying token handling", async () => {
  const env = environment(); env.setToken("saved-token");
  env.setResponse(() => { throw Error("network"); });
  const AppContent = env.load("App.js").default().props.children[0].props.children[0].type;
  env.setLocale("si"); const tr = env.load("localization/i18n.js").createI18n("si");
  assert.ok(text(env.render(AppContent)).includes(tr.t("auth.checkingSession")));
  await tick(); let tree = env.render(AppContent);
  assert.ok(text(tree).includes(tr.t("auth.sessionVerificationFailure")));
  env.setLocale("en"); tree = env.render(AppContent);
  assert.match(text(tree), /Could not verify your saved session/);
  env.setResponse({ status: 401 });
  await button(tree, "Retry session check").props.onPress();
  assert.deepEqual(env.deletes, ["edutrack_token"]);
  assert.match(text(env.render(AppContent)), /Learn with confidence/);
});

test("restoration validates supported roles; Teacher expiry clears only authentication", async () => {
  for (const role of ["student", "teacher", "parent", "admin"]) {
    const env = environment(); env.setToken("saved-token");
    const user = { id: "user-id", role, name: "Original", identifier: "ID" };
    env.setResponse({ ok: true, status: 200, json: async () => ({ user }) });
    const AppContent = env.load("App.js").default().props.children[0].props.children[0].type;
    env.render(AppContent); await tick(); const tree = env.render(AppContent);
      assert.equal(all(tree).some((n) => n.props.title === "Log out" || n.type === "TouchableOpacity" && text(n) === "Log out"), ["student", "teacher"].includes(role));
    if (["parent", "admin"].includes(role)) assert.match(text(tree), /Could not verify/);
  }
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "teacher");
  env.setLocale("si"); const tr = env.load("localization/i18n.js").createI18n("si");
  env.setResponse({ status: 401 });
  await button(env.render(AppContent), tr.t("dashboard.loadTeacherData")).props.onPress();
  assert.deepEqual(env.deletes, ["edutrack_token"]);
  assert.equal(env.alerts[0][0], tr.t("auth.sessionExpiredTitle"));
  assert.ok(text(env.render(AppContent)).includes(tr.t("welcome.heading")));
});

test("logout failure and Teacher session-read errors translate without losing the user", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "teacher");
  env.setReadError(true);
  await button(env.render(AppContent), "Load Teacher Data").props.onPress();
  env.setLocale("si"); const tr = env.load("localization/i18n.js").createI18n("si");
  assert.ok(text(env.render(AppContent)).includes(tr.t("auth.sessionReadFailure")));
  env.setDeleteError(true);
  await button(env.render(AppContent), tr.t("dashboard.logout")).props.onPress();
  assert.equal(env.alerts[0][0], tr.t("auth.logoutFailureTitle"));
  assert.equal(env.alerts[0][1], tr.t("auth.logoutFailure"));
  assert.ok(text(env.render(AppContent)).includes(tr.t("dashboard.teacher")));
});

test("Student dashboard prompts for a class before fetching materials", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "student");
  const Classes = env.load("components/MyClassesScreen.js").default;
  const Materials = env.load("components/LearningMaterialsScreen.js").default;
  const count = env.requests.length;
  env.setResponse({ ok: true, json: async () => ({ count: 0, classes: [] }) });
  const find = (tree, Component) => {
    const node = all(tree).find((n) => n.type === Component); assert.ok(node); return node;
  };
  let tree = env.render(AppContent);
  button(tree, "My Classes").props.onPress(); tree = env.render(AppContent);
  let classes = find(tree, Classes);
  assert.equal(classes.props.classes, undefined); assert.equal(classes.props.status, "loading");
  await tick();
  classes = find(env.render(AppContent), Classes);
  assert.match(text(Classes(classes.props)), /No enrolled classes yet/);
  assert.equal(env.hardwareBack(), true); tree = env.render(AppContent);
  env.setLocale("si"); tree = env.render(AppContent);
  const tr = env.load("localization/i18n.js").createI18n("si");
  button(tree, tr.t("materials.title")).props.onPress(); tree = env.render(AppContent);
  const materials = find(tree, Materials);
  assert.equal(materials.props.selectedClass, null); assert.equal(materials.props.status, "idle");
  assert.equal(materials.props.materials, undefined); assert.equal(materials.props.onDownload, undefined);
  assert.equal(materials.props.onView, undefined);
  assert.equal(all(tree).some((n) => n.type === "ScrollView"), false);
  assert.equal(env.requests.length, count + 1);
  materials.props.onBack(); tree = env.render(AppContent); classes = find(tree, Classes);
  classes.props.onBack(); tree = env.render(AppContent);
  button(tree, tr.t("student.myClasses")).props.onPress(); tree = env.render(AppContent);
  find(tree, Classes).props.onSelectClass(null); assert.ok(find(env.render(AppContent), Classes));
  env.unmount();
});

const qrAccount = "1".repeat(24), nextQrAccount = "2".repeat(24);
const qrToken = "test.header.signature";
const pngFixture = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAANUlEQVR4AbXBAQEAMAiAME7/zt4Qsr1ZHJOABCQgAQlIQAISkIAEJCABCUhAAhKQgAQkIIEPWTAEJs7/MYcAAAAASUVORK5CYII=";
function qrFixture(accountId = qrAccount, name = "QR Student") {
  return {
    student: { id: "3".repeat(24), userId: accountId, name, registrationNumber: "EDU-TEST", email: "student@example.test" },
    payload: "EDUTRACK:EDU-TEST:0123456789abcdef",
    qrImage: pngFixture,
  };
}

test("Student QR adapter validates the account, protected request and bounded PNG response", async () => {
  const env = environment(), { fetchStudentQR } = env.load("api/studentQR.js");
  const signal = new AbortController().signal;
  const options = { apiUrl: "http://test.invalid/", accountId: qrAccount, readToken: async () => qrToken, signal };
  const payload = qrFixture();
  env.setResponse({ ok: true, json: async () => payload });
  const result = await fetchStudentQR(options);
  assert.equal(result.status, "success");
  assert.equal(result.student.name, payload.student.name);
  assert.equal(result.student.registrationNumber, "EDU-TEST");
  assert.equal(result.student.email, undefined);
  assert.equal(result.payload, undefined);
  assert.equal(result.qrImage, pngFixture);
  assert.equal(env.requests[0].url, "http://test.invalid/api/qr/me");
  assert.equal(env.requests[0].options.method, "GET");
  assert.equal(env.requests[0].options.headers.Authorization, `Bearer ${qrToken}`);
  assert.equal(env.requests[0].options.signal, signal);

  const oversized = Buffer.from(pngFixture.split(",")[1], "base64");
  oversized.writeUInt32BE(2048, 16);
  oversized.writeUInt32BE(2048, 20);
  for (const variant of [null, qrFixture(nextQrAccount), { ...payload, student: { ...payload.student, userId: payload.student.id } },
    { ...payload, student: { ...payload.student, registrationNumber: "" } }, { ...payload, payload: "unsigned" },
    ...["https://test.invalid/qr.png", "data:image/jpeg;base64,AAAA", pngFixture.slice(0, -20),
      `data:image/png;base64,${"A".repeat(128 * 1024)}`, `data:image/png;base64,${oversized.toString("base64")}`]
      .map((qrImage) => ({ ...payload, qrImage }))]) {
    env.setResponse({ ok: true, json: async () => variant });
    assert.equal((await fetchStudentQR(options)).errorKey, "student.qrInvalid");
  }
  env.setResponse({ ok: true, json: async () => { throw new SyntaxError(); } });
  assert.equal((await fetchStudentQR(options)).errorKey, "student.qrInvalid");
  for (const [status, errorKey] of [[401, "auth.sessionExpired"], [403, "student.qrAccessDenied"],
    [404, "student.qrProfileNotFound"], [500, "student.qrUnavailable"]]) {
    env.setResponse({ ok: false, status });
    assert.equal((await fetchStudentQR(options)).errorKey, errorKey);
  }
  env.setResponse(() => { throw Error("offline"); });
  assert.equal((await fetchStudentQR(options)).errorKey, "student.connectionError");
  const count = env.requests.length;
  assert.equal((await fetchStudentQR({ ...options, readToken: async () => null })).errorKey, "auth.noSavedSession");
  assert.equal((await fetchStudentQR({ ...options, readToken: async () => "malformed" })).errorKey, "auth.sessionExpired");
  assert.equal((await fetchStudentQR({ ...options, readToken: async () => { throw Error(); } })).errorKey, "auth.sessionReadFailure");
  const controller = new AbortController();
  controller.abort();
  assert.equal((await fetchStudentQR({ ...options, signal: controller.signal })).status, "cancelled");
  assert.equal(env.requests.length, count);
});

test("Student QR renders localized loading, Retry, verified identity and image errors", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "student", qrAccount);
  const QR = env.load("components/StudentQRCardScreen.js").default;
  const screen = () => all(env.render(AppContent)).find((node) => node.type === QR).props;
  env.setToken(qrToken);
  env.setResponse({ ok: false, status: 404 });
  button(env.render(AppContent), "My QR Card").props.onPress();
  assert.match(text(QR(screen())), /Loading QR Card/);
  await tick();
  assert.match(text(QR(screen())), /Student profile not found/);
  const data = qrFixture();
  env.setResponse({ ok: true, json: async () => data });
  button(QR(screen()), "Retry").props.onPress();
  assert.equal(screen().status, "loading");
  await tick();
  const rendered = QR(screen());
  assert.match(text(rendered), /QR Student.*EDU-TEST/);
  assert.doesNotMatch(text(rendered), /0123456789abcdef/);
  const image = all(rendered).find((node) => node.type === "Image");
  assert.equal(image.props.source.uri, pngFixture);
  assert.equal(image.props.resizeMode, "contain");
  env.setLocale("si");
  const sinhala = env.load("localization/i18n.js").createI18n("si");
  assert.ok(text(QR(screen())).includes(sinhala.t("student.registrationLabel")));
  image.props.onError();
  assert.ok(text(QR(screen())).includes(sinhala.t("student.qrInvalid")));
  assert.equal(env.hardwareBack(), true);
  button(env.render(AppContent), sinhala.t("student.myQRCard"));
  env.unmount();
});

test("Back cancels pending QR and logout prevents late results from crossing Student sessions", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "student", qrAccount);
  const QR = env.load("components/StudentQRCardScreen.js").default;
  const open = () => {
    button(env.render(AppContent), "My QR Card").props.onPress();
    const props = all(env.render(AppContent)).find((node) => node.type === QR).props;
    assert.equal(props.status, "loading");
    return props;
  };
  const dashboard = env.render(AppContent);
  env.setToken(qrToken);
  let resolvePending;
  const pend = () => env.setResponse(() => new Promise((resolve) => { resolvePending = resolve; }));
  pend(); open(); await tick();
  const first = env.requests.at(-1).options.signal;
  assert.equal(env.hardwareBack(), true);
  assert.equal(first.aborted, true);
  resolvePending({ ok: true, json: async () => qrFixture() });
  await tick();
  pend(); open(); await tick();
  const second = env.requests.at(-1).options.signal;
  const stale = resolvePending;
  await button(dashboard, "Log out").props.onPress();
  assert.equal(second.aborted, true);

  button(env.render(AppContent), "Get started").props.onPress();
  button(env.render(AppContent), "I'm a student").props.onPress();
  const inputs = all(env.render(AppContent)).filter((node) => node.type === "TextInput");
  inputs[0].props.onChangeText("NEXT-STUDENT");
  inputs[1].props.onChangeText("test-password");
  const nextToken = "next.header.signature";
  env.setResponse({ ok: true, json: async () => ({ token: nextToken, user: {
    id: nextQrAccount, role: "student", name: "Next account", identifier: "NEXT-STUDENT",
  } }) });
  await button(env.render(AppContent), "Sign in").props.onPress();
  env.setResponse({ ok: true, json: async () => qrFixture(nextQrAccount, "Next QR Student") });
  open(); await tick();
  stale({ ok: true, json: async () => qrFixture() });
  await tick();
  const props = all(env.render(AppContent)).find((node) => node.type === QR).props;
  assert.equal(props.student.name, "Next QR Student");
  assert.equal(env.requests.at(-1).options.headers.Authorization, `Bearer ${nextToken}`);
  env.unmount();
});

test("combined class-selection passes the original object, clears on Back and returns to Classes", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "student");
  const Classes = env.load("components/MyClassesScreen.js").default;
  const Card = env.load("components/ClassCard.js").default;
  const Materials = env.load("components/LearningMaterialsScreen.js").default;
  const find = (tree, Component) => all(tree).find((n) => n.type === Component);
  const item = { id: "test-class", name: "Original class", subject: "Original subject" };
  env.setResponse({ ok: true, json: async () => ({ count: 1, classes: [item] }) });
  button(env.render(AppContent), "My Classes").props.onPress();
  env.render(AppContent); await tick();
  const screen = find(env.render(AppContent), Classes);
  assert.equal(screen.props.status, "success");
  const [classInfo] = screen.props.classes;
  assert.equal(classInfo.id, item.id);
  const list = Classes(screen.props);
  const card = Card(find(list, Card).props);
  assert.equal(card.type, "Pressable"); assert.equal(card.props.accessibilityRole, "button");
  assert.equal(Card({ classInfo }).type, "View");
  card.props.onPress(); let tree = env.render(AppContent);
  assert.equal(find(tree, Materials).props.selectedClass, classInfo);
  env.setLocale("si"); tree = env.render(AppContent);
  assert.equal(find(tree, Materials).props.selectedClass, classInfo);
  assert.equal(env.hardwareBack(), true); tree = env.render(AppContent); assert.ok(find(tree, Classes));
  find(tree, Classes).props.onBack(); tree = env.render(AppContent);
  const tr = env.load("localization/i18n.js").createI18n("si");
  button(tree, tr.t("materials.title")).props.onPress(); tree = env.render(AppContent);
  assert.equal(find(tree, Materials).props.selectedClass, null);
  assert.equal(env.requests.length, 2);
  env.unmount();
});

test("My Classes adapter sends the saved bearer token and maps only card fields", async () => {
  const env = environment();
  const { fetchStudentClasses } = env.load("api/studentClasses.js");
  const signal = new AbortController().signal;
  const options = { apiUrl: "http://test.invalid/", readToken: async () => "test-token", signal };
  const item = { id: "class-id", name: "Class", subject: "Subject", teacherId: "teacher-id",
    schedule: [{ day: "Monday", startTime: "09:00", endTime: "10:00" }] };
  env.setResponse({ ok: true, json: async () => ({ count: 1, classes: [item] }) });
  const result = await fetchStudentClasses(options);
  assert.equal(result.status, "success");
  assert.equal(result.classes[0].scheduleLabel, "Monday 09:00–10:00");
  assert.deepEqual(Object.keys(result.classes[0]).sort(), ["id", "name", "scheduleLabel", "subject"]);
  assert.equal(env.requests[0].url, "http://test.invalid/api/classes");
  assert.equal(env.requests[0].options.method, "GET");
  assert.equal(env.requests[0].options.headers.Authorization, "Bearer test-token");
  assert.equal(env.requests[0].options.signal, signal);
  for (const [status, key] of [[401, "auth.sessionExpired"], [403, "student.classesAccessDenied"],
    [404, "student.classesNotFound"], [500, "student.classesRequestFailed"]]) {
    env.setResponse({ ok: false, status });
    assert.equal((await fetchStudentClasses(options)).errorKey, key);
  }
  for (const payload of [null, { classes: [] }, { count: 1, classes: [] },
    { count: 2, classes: [item, item] }, { count: 1, classes: [{ ...item, schedule: [{}] }] }]) {
    env.setResponse({ ok: true, json: async () => payload });
    assert.equal((await fetchStudentClasses(options)).errorKey, "student.classesInvalid");
  }
  env.setResponse({ ok: true, json: async () => { throw new SyntaxError(); } });
  assert.equal((await fetchStudentClasses(options)).errorKey, "student.classesInvalid");
  env.setResponse(() => { throw new Error("network unavailable"); });
  assert.equal((await fetchStudentClasses(options)).errorKey, "student.connectionError");
  const requestCount = env.requests.length;
  assert.equal((await fetchStudentClasses({ ...options, readToken: async () => null })).errorKey, "auth.noSavedSession");
  assert.equal((await fetchStudentClasses({ ...options, readToken: async () => { throw new Error(); } })).errorKey, "auth.sessionReadFailure");
  assert.equal(env.requests.length, requestCount);
});

test("Retry refetches and a previous Student response cannot replace a new session’s classes", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "student");
  const Classes = env.load("components/MyClassesScreen.js").default;
  const find = (tree) => all(tree).find((n) => n.type === Classes);
  const open = () => {
    button(env.render(AppContent), "My Classes").props.onPress();
    return find(env.render(AppContent)).props;
  };
  env.setResponse({ ok: false, status: 404 });
  assert.equal(open().status, "loading");
  await tick();
  const failed = find(env.render(AppContent)).props;
  assert.equal(failed.errorKey, "student.classesNotFound");
  assert.doesNotMatch(text(Classes(failed)), /No enrolled classes/);

  let resolveOld;
  env.setResponse(() => new Promise((resolve) => { resolveOld = resolve; }));
  button(Classes(failed), "Retry").props.onPress();
  assert.equal(find(env.render(AppContent)).props.status, "loading");
  await tick();
  const oldSignal = env.requests.at(-1).options.signal;
  env.hardwareBack();
  await button(env.render(AppContent), "Log out").props.onPress();
  assert.equal(oldSignal.aborted, true);

  button(env.render(AppContent), "Get started").props.onPress();
  button(env.render(AppContent), "I'm a student").props.onPress();
  const inputs = all(env.render(AppContent)).filter((n) => n.type === "TextInput");
  inputs[0].props.onChangeText("OTHER-STUDENT");
  inputs[1].props.onChangeText("test-password");
  env.setResponse({ ok: true, json: async () => ({ token: "other-token", user: {
    id: "other-id", role: "student", name: "Other Student", identifier: "OTHER-STUDENT",
  } }) });
  await button(env.render(AppContent), "Sign in").props.onPress();
  env.setResponse({ ok: true, json: async () => ({ count: 0, classes: [] }) });
  assert.equal(open().status, "loading");
  await tick();
  resolveOld({ ok: true, json: async () => ({ count: 1, classes: [{ id: "old", name: "Old class" }] }) });
  await tick();
  const current = find(env.render(AppContent)).props;
  assert.equal(current.status, "success");
  assert.equal(current.classes.length, 0);
  assert.equal(env.requests.at(-1).options.headers.Authorization, "Bearer other-token");
  env.unmount();
});

test("combined My Classes validates malformed results and preserves localized Retry", () => {
  const env = environment(), Classes = env.load("components/MyClassesScreen.js").default;
  let retries = 0;
  for (const classes of [undefined, null, "invalid", {}, [null], [{}], [{ id: "one", name: {} }]]) {
    const tree = Classes({ classes, status: "success", onBack() {}, onRetry: () => { retries++; } });
    assert.match(text(tree), /class information could not be displayed/);
    button(tree, "Retry").props.onPress();
  }
  assert.equal(retries, 7);
  assert.match(text(Classes({ classes: [], status: "success" })), /No enrolled classes yet/);
  const tree = Classes({ status: "error" });
  assert.equal(all(tree).some((n) => n.type === "TouchableOpacity" && text(n) === "Retry"), false);
});

test("Materials without a selection prompt for a class in both languages", () => {
  const env = environment(), Materials = env.load("components/LearningMaterialsScreen.js").default;
  for (const locale of ["en", "si"]) {
    env.setLocale(locale);
    const tree = env.render(() => Materials({ status: "idle", onBack() {} }));
    const list = all(tree).find((n) => n.type === "FlatList"); assert.ok(list);
    assert.equal(list.props.data.length, 0);
    const tr = env.load("localization/i18n.js").createI18n(locale);
    assert.ok(text(list.props.ListEmptyComponent).includes(tr.t("materials.unavailable")));
    assert.equal(all(tree).some((n) => n.type === "ScrollView"), false);
    assert.equal(all(list.props.ListHeaderComponent).find((n) => n.type === "TextInput").props.value, "");
  }
});

test("Materials adapter authenticates, scopes rows, and maps metadata from the actual contract", async () => {
  const env = environment();
  const { fetchStudentMaterials } = env.load("api/studentMaterials.js");
  const signal = new AbortController().signal;
  const classId = "selected&class";
  const options = { apiUrl: "http://test.invalid/", classId, readToken: async () => "student-token", signal };
  const item = { id: "material", title: "Lesson", description: "Lesson notes", classId, fileType: "pdf",
    size: 1536, createdAt: "2026-10-02T01:00:00.000Z", downloadUrl: "/api/materials/material/download" };
  const respond = (...materials) => env.setResponse({ ok: true, json: async () => ({ count: materials.length, materials }) });
  respond(item, { id: "older-record", title: "Older notes", classId });
  const result = await fetchStudentMaterials(options);
  assert.equal(result.status, "success");
  assert.equal(result.materials.length, 2);
  const first = result.materials[0];
  assert.equal(first.description, "Lesson notes");
  assert.equal(first.fileType, "pdf");
  assert.equal(first.fileSizeLabel, "1.5 KB");
  assert.equal(first.addedDateLabel, "2026-10-02");
  assert.equal(first.downloadUrl, undefined);
  assert.equal(result.materials[1].fileSizeLabel, undefined);
  assert.equal(env.requests[0].url, "http://test.invalid/api/materials?classId=selected%26class");
  assert.equal(env.requests[0].options.method, "GET");
  assert.equal(env.requests[0].options.headers.Authorization, "Bearer student-token");
  assert.equal(env.requests[0].options.signal, signal);
  respond();
  const empty = await fetchStudentMaterials(options);
  assert.equal(empty.status, "success");
  assert.equal(empty.materials.length, 0);

  for (const payload of [null, { materials: [] }, { count: 1, materials: [] },
    { count: 2, materials: [item, item] }, { count: 1, materials: [null] },
    ...[{ classId: "different" }, { title: " " }, { createdAt: "invalid" }, { size: -1 }]
      .map((invalid) => ({ count: 1, materials: [{ ...item, ...invalid }] }))]) {
    env.setResponse({ ok: true, json: async () => payload });
    assert.equal((await fetchStudentMaterials(options)).errorKey, "materials.invalidResponse");
  }
  env.setResponse({ ok: true, json: async () => { throw new SyntaxError(); } });
  assert.equal((await fetchStudentMaterials(options)).errorKey, "materials.invalidResponse");
  for (const [status, errorKey] of [[401, "auth.sessionExpired"], [403, "materials.accessDenied"],
    [404, "materials.notFound"], [500, "materials.error"]]) {
    env.setResponse({ status, ok: false });
    assert.equal((await fetchStudentMaterials(options)).errorKey, errorKey);
  }
  env.setResponse(() => { throw new Error("network error"); });
  assert.equal((await fetchStudentMaterials(options)).errorKey, "materials.connectionError");
  const count = env.requests.length;
  assert.equal((await fetchStudentMaterials({ ...options, readToken: async () => null })).errorKey, "auth.noSavedSession");
  const controller = new AbortController();
  assert.equal(await fetchStudentMaterials({ ...options, signal: controller.signal, readToken: async () => {
    controller.abort();
    return "student-token";
  } }), undefined);
  assert.equal(env.requests.length, count);
});

test("Materials retries for the selected class and ignores late results after navigation and logout", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "student");
  const Classes = env.load("components/MyClassesScreen.js").default;
  const Materials = env.load("components/LearningMaterialsScreen.js").default;
  const classes = [{ id: "first", name: "First class" }, { id: "second", name: "Second class" }];
  const readScreen = (Component) => all(env.render(AppContent)).find((node) => node.type === Component)?.props;
  const select = async (id) => {
    readScreen(Classes);
    await tick();
    const list = readScreen(Classes);
    list.onSelectClass(list.classes.find((item) => item.id === id));
    assert.equal(readScreen(Materials).status, "loading");
    await tick();
  };
  let resolveOld, resolveBeforeLogout, secondRequests = 0;
  env.setResponse((url) => {
    if (url.endsWith("/api/classes")) return { ok: true, json: async () => ({ count: 2, classes }) };
    if (url.endsWith("classId=first")) return new Promise((resolve) => { resolveOld = resolve; });
    assert.ok(url.endsWith("classId=second"));
    secondRequests++;
    if (secondRequests === 1) return { ok: false, status: 403 };
    if (secondRequests === 3) return new Promise((resolve) => { resolveBeforeLogout = resolve; });
    return { ok: true, json: async () => ({ count: 0, materials: [] }) };
  });
  button(env.render(AppContent), "My Classes").props.onPress();
  await select("first");
  const firstRequest = env.requests.at(-1);
  assert.equal(firstRequest.options.headers.Authorization, "Bearer test-token");
  assert.equal(env.hardwareBack(), true);
  await select("second");
  assert.equal(firstRequest.options.signal.aborted, true);
  const failed = readScreen(Materials);
  assert.equal(failed.status, "error");
  assert.equal(failed.errorKey, "materials.accessDenied");
  failed.onRetry();
  assert.equal(readScreen(Materials).status, "loading");
  await tick();
  resolveOld({ ok: true, json: async () => ({ count: 1, materials: [{ id: "old", title: "Old", classId: "first" }] }) });
  await tick();
  assert.equal(readScreen(Materials).selectedClass.id, "second");
  assert.equal(readScreen(Materials).status, "success");
  assert.equal(readScreen(Materials).materials.length, 0);

  assert.equal(env.hardwareBack(), true);
  await select("second");
  const pending = env.requests.at(-1);
  assert.equal(env.hardwareBack(), true);
  readScreen(Classes);
  assert.equal(env.hardwareBack(), true);
  await button(env.render(AppContent), "Log out").props.onPress();
  assert.equal(pending.options.signal.aborted, true);
  resolveBeforeLogout({ ok: true, json: async () => ({ count: 1, materials: [{ id: "old-session", title: "Old session", classId: "second" }] }) });
  await tick();
  assert.equal(readScreen(Materials), undefined);
  button(env.render(AppContent), "Get started");
  env.unmount();
});

test("Materials shows descriptions and metadata, supports Search and distinguishes empty states", () => {
  const env = environment(), Materials = env.load("components/LearningMaterialsScreen.js").default;
  const items = [{ id: "one", title: "Topic", description: "Find this note", fileType: "pdf", fileSizeLabel: "1 KB", addedDateLabel: "2026-10-02" }];
  const list = (props) => all(env.render(() => Materials(props))).find((node) => node.type === "FlatList").props;
  let view = list({ materials: items });
  const item = view.renderItem({ item: view.data[0] });
  const card = item.type(item.props);
  assert.match(text(card), /Topic.*Find this note.*PDF.*1 KB.*Added 2026-10-02/);
  assert.equal(all(card).some((node) => node.type === "Pressable"), false);
  const search = all(view.ListHeaderComponent).find((node) => node.type === "TextInput");
  search.props.onChangeText("this note");
  assert.equal(list({ materials: items }).data.length, 1);
  search.props.onChangeText("missing");
  assert.match(text(list({ materials: items }).ListEmptyComponent), /No materials match/);
  button(view.ListHeaderComponent, "Downloaded").props.onPress();
  assert.match(text(list({ materials: items }).ListEmptyComponent), /No downloaded materials/);
  button(view.ListHeaderComponent, "All").props.onPress();
  assert.match(text(list({ materials: [] }).ListEmptyComponent), /no learning materials for this class/);
  let retries = 0;
  view = list({ status: "error", errorKey: "materials.accessDenied", onRetry: () => { retries++; } });
  assert.match(text(view.ListEmptyComponent), /do not have access/);
  button(view.ListEmptyComponent, "Retry").props.onPress();
  assert.equal(retries, 1);
});

test("combined Student-only controls are absent for Teachers", async () => {
  const env = environment(), { AppContent } = await authenticatedDashboard(env, "teacher");
  const tree = env.render(AppContent);
  for (const title of ["My Classes", "My QR Card", "Learning materials"]) {
    assert.equal(all(tree).some((n) => n.props.title === title || n.type === "TouchableOpacity" && text(n) === title), false);
  }
  assert.ok(button(tree, "Load Teacher Data"));
  assert.equal(env.hardwareBack(), undefined);
});

function mockPdfFiles() {
  const files = new Map(), transfers = [], previews = [];
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  let transfer = async (file) => { files.set(file.uri, pdf); };
  const uri = (parts) => parts.map((part) => part.uri ?? part).join("/");
  class Directory {
    constructor(...parts) { this.uri = uri(parts); }
    async create() {}
  }
  class File {
    constructor(...parts) { this.uri = uri(parts); }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length; }
    open() {
      const bytes = files.get(this.uri);
      return { offset: 0, readBytesSync(count) {
        const result = bytes.subarray(this.offset, this.offset + count);
        this.offset += result.length;
        return result;
      }, close() {} };
    }
    async delete() { files.delete(this.uri); }
    async move(to) {
      files.set(to.uri, files.get(this.uri));
      files.delete(this.uri);
      this.uri = to.uri;
    }
    async preview(options) { previews.push({ uri: this.uri, options }); }
    static async downloadFileAsync(url, file, options) {
      transfers.push({ url, options });
      await transfer(file, options);
      return new File(file.uri);
    }
  }
  return { api: { Directory, File, Paths: { document: "file:///documents" }, FileMode: { ReadOnly: "r" } },
    files, transfers, previews, pdf, setTransfer: (fn) => { transfer = fn; } };
}

const pdfStudent = "1".repeat(24), otherPdfStudent = "2".repeat(24);
const pdfClass = "a".repeat(24), otherPdfClass = "b".repeat(24);
const pdfId = "c".repeat(24);

test("PDF download uses the bearer header and persists valid files for one Student and class", async () => {
  const native = mockPdfFiles();
  const service = environment(native.api).load("api/studentPdfDownloads.js");
  const material = { id: pdfId, title: "Notes", fileType: "pdf", size: native.pdf.length };
  const options = { apiUrl: "http://test.invalid/", studentId: pdfStudent, classId: pdfClass,
    material, readToken: async () => "student-token", signal: new AbortController().signal };
  await service.downloadStudentPdf(options);
  assert.equal(native.transfers[0].url, `http://test.invalid/api/materials/${pdfId}/download`);
  assert.equal(native.transfers[0].options.headers.Authorization, "Bearer student-token");
  assert.equal(native.transfers[0].options.signal, options.signal);
  const stored = `file:///documents/edutrack-pdfs/${pdfStudent}/${pdfClass}/${pdfId}.pdf`;
  assert.deepEqual([...native.files.keys()], [stored]);
  const reopened = environment(native.api).load("api/studentPdfDownloads.js");
  assert.equal(reopened.getDownloadedPdfIds(pdfStudent, pdfClass, [material]).join(), pdfId);
  assert.equal(reopened.getDownloadedPdfIds(otherPdfStudent, pdfClass, [material]).length, 0);
  assert.equal(reopened.getDownloadedPdfIds(pdfStudent, otherPdfClass, [material]).length, 0);
  await assert.rejects(reopened.viewSavedPdf({ ...options, studentId: otherPdfStudent }), /not saved/);
  await reopened.viewSavedPdf(options);
  assert.equal(native.previews[0].uri, stored);
  assert.equal(native.previews[0].options.mimeType, "application/pdf");
  await service.downloadStudentPdf(options);
  assert.equal(native.transfers.length, 1);
  native.files.delete(stored);
  assert.equal(reopened.getDownloadedPdfIds(pdfStudent, pdfClass, [material]).length, 0);
  await assert.rejects(reopened.viewSavedPdf(options), /not saved/);
});

test("PDF failures and cancellation leave no incomplete files and duplicate transfers are blocked", async () => {
  const native = mockPdfFiles();
  const service = environment(native.api).load("api/studentPdfDownloads.js");
  const material = { id: pdfId, fileType: "pdf", size: native.pdf.length };
  const options = { apiUrl: "https://test.invalid", studentId: pdfStudent, classId: pdfClass,
    material, readToken: async () => "student-token" };
  for (const token of [null, "", "bad token"]) {
    await assert.rejects(service.downloadStudentPdf({ ...options, readToken: async () => token }), /session unavailable/);
  }
  await assert.rejects(service.downloadStudentPdf({ ...options, material: { ...material, id: "../notes" } }), /Invalid PDF/);
  assert.equal(native.transfers.length, 0);
  for (const status of [401, 403, 404, 500]) {
    native.setTransfer(async () => { throw new Error(`HTTP ${status}`); });
    await assert.rejects(service.downloadStudentPdf(options), new RegExp(String(status)));
    assert.equal(native.files.size, 0);
  }
  native.setTransfer(async (file) => {
    native.files.set(file.uri, native.pdf.subarray(0, 12));
    throw new Error("connection lost");
  });
  await assert.rejects(service.downloadStudentPdf(options), /connection lost/);
  assert.equal(native.files.size, 0);
  for (const bad of [Buffer.alloc(native.pdf.length, "{}"), native.pdf.subarray(0, -6), Buffer.from("%PDF-1.4\n%%EOF\n")]) {
    native.setTransfer(async (file) => { native.files.set(file.uri, bad); });
    await assert.rejects(service.downloadStudentPdf(options), /Invalid PDF received/);
    assert.equal(native.files.size, 0);
  }
  native.setTransfer(async (file) => { native.files.set(file.uri, Buffer.from("%PDF-1.4\npartial")); });
  await assert.rejects(service.downloadStudentPdf({ ...options, material: { ...material, size: undefined } }), /Invalid PDF received/);
  const controller = new AbortController();
  let finish;
  native.setTransfer((file) => new Promise((resolve) => {
    finish = () => { native.files.set(file.uri, native.pdf); resolve(); };
  }));
  const first = service.downloadStudentPdf({ ...options, signal: controller.signal });
  await tick();
  await assert.rejects(service.downloadStudentPdf(options), /already in progress/);
  controller.abort();
  finish();
  await assert.rejects(first, /cancelled/);
  assert.equal(native.files.size, 0);
});

test("Materials cancels PDF transfers on Back and prevents late feedback after logout", async () => {
  const native = mockPdfFiles();
  const env = environment(native.api), { AppContent } = await authenticatedDashboard(env, "student", pdfStudent);
  const Classes = env.load("components/MyClassesScreen.js").default;
  const Materials = env.load("components/LearningMaterialsScreen.js").default;
  const screen = (Component) => all(env.render(AppContent)).find((node) => node.type === Component)?.props;
  const classes = [{ id: pdfClass, name: "First class" }, { id: otherPdfClass, name: "Second class" }];
  env.setResponse((url) => ({ ok: true, json: async () => url.endsWith("/api/classes")
    ? { count: classes.length, classes }
    : { count: 1, materials: [{ id: pdfId, title: "Notes", fileType: "pdf", size: native.pdf.length, classId: url.split("=")[1] }] } }));
  const select = async (id) => {
    screen(Classes);
    await tick();
    const props = screen(Classes);
    props.onSelectClass(props.classes.find((item) => item.id === id));
    screen(Materials);
    await tick();
    screen(Materials);
    await tick();
    return screen(Materials);
  };
  let finish;
  native.setTransfer((file) => new Promise((resolve) => {
    finish = () => { native.files.set(file.uri, native.pdf); resolve(); };
  }));
  button(env.render(AppContent), "My Classes").props.onPress();
  const firstClass = await select(pdfClass);
  const oldDownload = firstClass.onDownload(firstClass.materials[0]);
  await tick();
  assert.equal(screen(Materials).pdfFeedback[pdfId], "materials.downloading");
  assert.equal(env.hardwareBack(), true);
  assert.equal(native.transfers[0].options.signal.aborted, true);
  const secondClass = await select(otherPdfClass);
  finish();
  await oldDownload;
  assert.equal(screen(Materials).downloadedMaterialIds.length, 0);
  assert.equal(screen(Materials).pdfFeedback[pdfId], undefined);
  const laterDownload = secondClass.onDownload(secondClass.materials[0]);
  await tick();
  assert.equal(env.hardwareBack(), true);
  screen(Classes);
  assert.equal(env.hardwareBack(), true);
  await button(env.render(AppContent), "Log out").props.onPress();
  assert.equal(native.transfers[1].options.signal.aborted, true);
  finish();
  await laterDownload;
  assert.equal(native.files.size, 0);
  assert.equal(screen(Materials), undefined);
  env.unmount();
});

test("Materials shows a saved PDF only after transfer success and rechecks it when reopening", async () => {
  const native = mockPdfFiles();
  const env = environment(native.api), { AppContent } = await authenticatedDashboard(env, "student", pdfStudent);
  const Classes = env.load("components/MyClassesScreen.js").default;
  const Materials = env.load("components/LearningMaterialsScreen.js").default;
  const screen = (Component) => all(env.render(AppContent)).find((node) => node.type === Component)?.props;
  env.setResponse((url) => ({ ok: true, json: async () => url.endsWith("/api/classes")
    ? { count: 1, classes: [{ id: pdfClass, name: "Mathematics" }] }
    : { count: 1, materials: [{ id: pdfId, title: "Notes", fileType: "pdf", size: native.pdf.length, classId: pdfClass }] } }));
  const select = async () => {
    screen(Classes);
    await tick();
    const classes = screen(Classes);
    classes.onSelectClass(classes.classes[0]);
    screen(Materials);
    await tick();
    screen(Materials);
    await tick();
    return screen(Materials);
  };
  button(env.render(AppContent), "My Classes").props.onPress();
  let props = await select();
  native.setTransfer(async () => { throw new Error("connection lost"); });
  await props.onDownload(props.materials[0]);
  props = screen(Materials);
  assert.equal(props.downloadedMaterialIds.length, 0);
  assert.equal(props.pdfFeedback[pdfId], "materials.downloadFailed");
  native.setTransfer(async (file) => { native.files.set(file.uri, native.pdf); });
  await props.onDownload(props.materials[0]);
  props = screen(Materials);
  assert.equal(props.downloadedMaterialIds.join(), pdfId);
  assert.equal(props.pdfFeedback[pdfId], "materials.pdfSaved");
  props.onBack();
  props = await select();
  assert.equal(props.downloadedMaterialIds.join(), pdfId);
  await props.onView(props.materials[0]);
  assert.equal(native.previews.length, 1);
  native.files.clear();
  await props.onView(props.materials[0]);
  assert.equal(screen(Materials).downloadedMaterialIds.length, 0);
  assert.equal(screen(Materials).pdfFeedback[pdfId], "materials.pdfUnavailable");
  env.unmount();
});

test("Materials cards localize PDF actions and downloaded filtering uses saved IDs", () => {
  const env = environment(), Materials = env.load("components/LearningMaterialsScreen.js").default;
  const material = { id: pdfId, title: "Notes", fileType: "pdf" };
  const other = { id: "3".repeat(24), title: "Document", fileType: "document" };
  const opened = [], requested = [];
  const renderList = (overrides) => all(env.render(() => Materials({ materials: [material, other],
    onDownload: (item) => requested.push(item), onView: (item) => opened.push(item), ...overrides })))
    .find((node) => node.type === "FlatList").props;
  const display = (list, index = 0) => {
    const card = list.renderItem({ item: list.data[index] });
    return card.type(card.props);
  };
  let list = renderList();
  all(display(list)).find((node) => node.type === "Pressable").props.onPress();
  assert.equal(requested[0], material);
  assert.equal(all(display(list, 1)).some((node) => node.type === "Pressable"), false);
  assert.match(text(display(renderList({ pdfFeedback: { [pdfId]: "materials.downloading" } }))), /Downloading/);
  assert.match(text(display(renderList({ pdfFeedback: { [pdfId]: "materials.downloadFailed" } }))), /Download failed.*Retry/);
  button(list.ListHeaderComponent, "Downloaded").props.onPress();
  assert.equal(renderList().data.length, 0);
  env.setLocale("si");
  list = renderList({ downloadedMaterialIds: [pdfId], pdfFeedback: { [pdfId]: "materials.pdfSaved" } });
  assert.equal(list.data.length, 1);
  const card = display(list);
  const sinhala = env.load("localization/i18n.js").createI18n("si");
  assert.ok(text(card).includes(sinhala.t("materials.pdfSaved")));
  assert.ok(text(card).includes(sinhala.t("materials.openPdf")));
  all(card).find((node) => node.type === "Pressable").props.onPress();
  assert.equal(opened[0], material);
});
