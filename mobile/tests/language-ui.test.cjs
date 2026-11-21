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

function environment() {
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
      return [slots[i], (v) => { slots[i] = v; }];
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

async function authenticatedDashboard(env, role) {
  const AppContent = await loginScreen(env, role);
  let tree = env.render(AppContent), inputs = all(tree).filter((n) => n.type === "TextInput");
  inputs[0].props.onChangeText(role === "student" ? "ET-TEST" : "teacher@example.test");
  inputs[1].props.onChangeText("test-password");
  const user = { id: "test-user", role, name: "Untranslated Name", identifier: "ORIGINAL-ID" };
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

test("Student dashboard keeps QR offline and prompts for a class before fetching materials", async () => {
  const env = environment(), { AppContent, user } = await authenticatedDashboard(env, "student");
  const Classes = env.load("components/MyClassesScreen.js").default;
  const QR = env.load("components/StudentQRCardScreen.js").default;
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
  button(tree, "My QR Card").props.onPress(); tree = env.render(AppContent);
  const qr = find(tree, QR); assert.equal(qr.props.student, user);
  const qrTree = QR(qr.props);
  assert.ok(text(qrTree).includes(user.name)); assert.ok(text(qrTree).includes(user.identifier));
  assert.match(text(qrTree), /QR code not available yet/);
  env.setLocale("si"); tree = env.render(AppContent);
  const tr = env.load("localization/i18n.js").createI18n("si");
  assert.ok(text(QR(find(tree, QR).props)).includes(tr.t("student.qrUnavailable")));
  find(tree, QR).props.onBack(); tree = env.render(AppContent);
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
