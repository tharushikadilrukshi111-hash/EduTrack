// Run: node --test mobile/tests/localization.test.cjs (from repository root).
// Real i18n-js; React hooks and native SecureStore are mocked, not device-tested.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const babel = require(require.resolve("@babel/core", { paths: [root] }));
const plugins = ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"]
  .map((name) => require.resolve(name, { paths: [root] }));

function loadModule(file, mocks = {}, cache = {}) {
  file = path.resolve(root, file);
  if (cache[file]) return cache[file].exports;
  const module = { exports: {} };
  cache[file] = module;
  const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), {
    plugins, babelrc: false, configFile: false,
  });
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name.startsWith(".")) return loadModule(path.resolve(path.dirname(file), `${name}.js`), mocks, cache);
      return require(require.resolve(name, { paths: [root] }));
    },
  }, { filename: file });
  return module.exports;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(storage) {
  const slots = [];
  const cleanups = [];
  let cursor = 0;
  let pending = [];
  const React = {
    createContext: (value) => ({ value, Provider: "Provider" }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useContext: (context) => context.value,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => { slots[index] = next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        slots[index] = { deps, value: factory() };
      }
      return slots[index].value;
    },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(fn) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = true; pending.push(fn); }
    },
  };
  const api = loadModule("context/LanguageContext.js", { react: React, "expo-secure-store": storage });
  return {
    ...api,
    render() {
      cursor = 0;
      const tree = api.LanguageProvider({ children: "child" });
      pending.splice(0).forEach((effect) => cleanups.push(effect()));
      return tree.props.value;
    },
    unmount() { cleanups.forEach((cleanup) => cleanup?.()); },
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const { createI18n, isSupportedLanguage } = loadModule("localization/i18n.js");
const en = loadModule("localization/en.js").default;
const si = loadModule("localization/si.js").default;
function leaves(object, prefix = "") {
  return Object.entries(object).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[name, value]] : leaves(value, name);
  });
}

test("matching dictionaries: every English/Sinhala leaf and interpolation", () => {
  assert.deepEqual(leaves(en).map(([key]) => key).sort(), leaves(si).map(([key]) => key).sort());
  for (const [locale, dictionary] of [["en", en], ["si", si]]) {
    const translator = createI18n(locale);
    for (const [key, text] of leaves(dictionary)) {
      assert.ok(text.trim());
      assert.equal(translator.t(key, { name: "Sadeepa" }), text.replace("%{name}", "Sadeepa"));
      if (locale === "si" && key !== "language.english") assert.match(text, /[\u0D80-\u0DFF]/);
    }
  }
});

test("English fallback for missing Sinhala keys and explicit default for unknown keys", () => {
  const translator = createI18n("si");
  translator.store({ en: { testOnlyFallback: "English fallback" } });
  assert.equal(translator.t("testOnlyFallback"), "English fallback");
  assert.equal(translator.t("unknown.key", { defaultValue: "Unavailable" }), "Unavailable");
});

test("supported codes only and independent translator instances", () => {
  for (const locale of ["en", "si"]) assert.equal(isSupportedLanguage(locale), true);
  for (const locale of [undefined, null, "EN", "si-LK", "fr", {}, 1]) {
    assert.equal(isSupportedLanguage(locale), false);
    if (locale !== undefined) assert.throws(() => createI18n(locale), { name: "RangeError" });
  }
  assert.equal(createI18n().locale, "en");
  assert.equal(createI18n("en").t("common.save"), en.common.save);
  assert.equal(createI18n("si").t("common.save"), si.common.save);
});

test("initial English, saved Sinhala, reactive translations and stable callbacks", async () => {
  const writes = [];
  const h = harness({
    getItemAsync: async (key) => { assert.equal(key, "edutrack_language"); return "si"; },
    setItemAsync: async (...args) => { writes.push(args); },
  });
  assert.equal(h.render().language, "en");
  await tick();
  const saved = h.render();
  assert.equal(saved.language, "si");
  assert.equal(saved.t("common.save"), si.common.save);
  assert.equal(saved, h.render());
  assert.equal(await saved.setLanguage("en"), true);
  const changed = h.render();
  assert.equal(changed.language, "en");
  assert.equal(changed.setLanguage, saved.setLanguage);
  assert.equal(changed.t("common.save", { locale: "si" }), en.common.save);
  assert.deepEqual(writes, [["edutrack_language", "en"]]);
});

test("missing, invalid, or unreadable stored preferences fall back to English", async () => {
  for (const saved of [null, undefined, "fr", "SI", "", new Error("unavailable")]) {
    const h = harness({ getItemAsync: async () => { if (saved instanceof Error) throw saved; return saved; } });
    h.render(); await tick(); assert.equal(h.render().language, "en");
  }
});

test("unsupported setLanguage is rejected without changing UI or storage", async () => {
  let writes = 0;
  const h = harness({ getItemAsync: async () => null, setItemAsync: async () => { writes++; } });
  const value = h.render();
  for (const invalid of [null, undefined, "SI", "ta", {}, 1]) assert.equal(await value.setLanguage(invalid), false);
  assert.equal(h.render().language, "en"); assert.equal(writes, 0);
});

test("write failure keeps selection usable and does not block later writes", async () => {
  let fail = true;
  const h = harness({ getItemAsync: async () => null, setItemAsync: async () => { if (fail) throw Error("unavailable"); } });
  const value = h.render();
  assert.equal(await value.setLanguage("si"), false);
  assert.equal(h.render().language, "si");
  fail = false;
  assert.equal(await value.setLanguage("en"), true);
  assert.equal(h.render().language, "en");
});

test("late initial read cannot overwrite a newer selection, even English", async () => {
  const read = deferred();
  const h = harness({ getItemAsync: () => read.promise, setItemAsync: async () => {} });
  await h.render().setLanguage("en");
  read.resolve("si"); await tick();
  assert.equal(h.render().language, "en");
});

test("rapid writes are serialized and latest selection is persisted last", async () => {
  const firstWrite = deferred(), writes = [];
  const h = harness({ getItemAsync: async () => null, setItemAsync: async (key, value) => {
    assert.equal(key, "edutrack_language"); writes.push(value);
    if (writes.length === 1) await firstWrite.promise;
  } });
  const value = h.render();
  const first = value.setLanguage("si"), last = value.setLanguage("en");
  await tick(); assert.deepEqual(writes, ["si"]);
  firstWrite.resolve(); await Promise.all([first, last]);
  assert.deepEqual(writes, ["si", "en"]);
  assert.equal(h.render().language, "en");
});

test("unmount ignores pending reads; hook outside provider gives a clear error", async () => {
  const read = deferred();
  const h = harness({ getItemAsync: () => read.promise });
  h.render(); h.unmount(); read.resolve("si"); await tick();
  assert.equal(h.render().language, "en");
  assert.throws(() => h.useLanguage(), /LanguageProvider/);
});
