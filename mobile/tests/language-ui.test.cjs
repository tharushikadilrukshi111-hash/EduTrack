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
  let cursor = 0, pending = [], locale = "en", savingResult = true;
  let save = async () => savingResult;
  let response = { ok: false, json: async () => ({ message: "Backend message" }) };
  const React = {
    createElement: (type, props, ...children) => {
      const merged = { ...props, ...(children.length ? { children } : {}) };
      if (["LocalizedText", "LocalizedTextInput", "SinhalaText", "SinhalaTextInput"].includes(type.name)) return type(merged);
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
    useEffect(fn) {
      const i = cursor++;
      if (!(i in slots)) { slots[i] = true; pending.push(fn); }
    },
  };
  const flatten = (s) => Array.isArray(s) ? Object.assign({}, ...s.map(flatten)) : s || {};
  const native = new Proxy({ StyleSheet: { create: (s) => s, flatten }, Platform: { OS: "android" }, Alert: { alert: (...args) => alerts.push(args) } }, {
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
  const node = all(tree).find((n) => n.props.title === title);
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
    assert.equal(all(tree).some((n) => n.props.title === "Log out"), ["student", "teacher"].includes(role));
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
