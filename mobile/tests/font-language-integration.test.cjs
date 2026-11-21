// Real providers/i18n; mocked hooks, expo-font and SecureStore. No native rendering.
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
const flatten = (style) => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};

function setup(saved = null) {
  let current, fontResult = [false, null], read = async () => saved;
  const writes = [], cache = {};
  const React = {
    createContext: (value) => { const context = { value }; context.Provider = context; return context; },
    useContext: (context) => context.value,
    forwardRef: (fn) => fn,
    createElement: (type, props, ...children) => ({ type, props: { ...props, ...(children.length ? { children } : {}) } }),
    useState(initial) {
      const i = current.cursor++, runner = current;
      if (!(i in runner.slots)) runner.slots[i] = initial;
      return [runner.slots[i], (value) => { runner.slots[i] = value; }];
    },
    useRef(initial) {
      const i = current.cursor++;
      if (!(i in current.slots)) current.slots[i] = { current: initial };
      return current.slots[i];
    },
    useMemo(fn, deps) {
      const i = current.cursor++, previous = current.slots[i];
      if (!previous || deps.some((value, j) => value !== previous.deps[j])) current.slots[i] = { value: fn(), deps };
      return current.slots[i].value;
    },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(fn) {
      const i = current.cursor++;
      if (!(i in current.slots)) { current.slots[i] = true; current.pending.push(fn); }
    },
  };
  function load(file) {
    file = path.resolve(root, file);
    if (cache[file]) return cache[file].exports;
    const module = { exports: {} }; cache[file] = module;
    const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), { plugins, babelrc: false, configFile: false });
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require(name) {
        if (name === "react") return React;
        if (name === "react-native") return { Text: "Text", TextInput: "TextInput", StyleSheet: { create: (s) => s, flatten } };
        if (name === "expo-secure-store") return {
          getItemAsync: (key) => { assert.equal(key, "edutrack_language"); return read(); },
          setItemAsync: async (key, value) => { assert.equal(key, "edutrack_language"); writes.push(value); },
        };
        if (name === "expo-font") return { useFonts: (assets) => {
          assert.deepEqual(Object.keys(assets), ["NotoSansSinhala-Regular", "NotoSansSinhala-Bold"]);
          return fontResult;
        } };
        if (name.endsWith(".ttf")) {
          const asset = path.resolve(path.dirname(file), name);
          assert.ok(fs.statSync(asset).size > 0); return asset;
        }
        return name.startsWith(".") ? load(path.resolve(path.dirname(file), `${name}.js`)) : require(resolve(name));
      },
    }, { filename: file });
    return module.exports;
  }
  const language = load("context/LanguageContext.js");
  const fonts = load("components/SinhalaTypography.js");
  const typography = load("components/LocalizedTypography.js");
  function providerRunner(Component) {
    const runner = { slots: [], cursor: 0, pending: [] };
    return () => {
      current = runner; runner.cursor = 0; runner.pending = [];
      const tree = Component({ children: "App remains visible" });
      tree.type.value = tree.props.value;
      runner.pending.forEach((fn) => fn());
      assert.equal(tree.props.children[0], "App remains visible");
    };
  }
  const renderLanguage = providerRunner(language.LanguageProvider);
  const renderFonts = providerRunner(fonts.SinhalaFontProvider);
  function native(Component, props, ref) {
    let node = Component(props, ref);
    while (typeof node.type === "function") node = node.type(node.props, node.props.ref);
    return node;
  }
  return {
    ...language, ...typography, writes, native,
    render() { renderLanguage(); renderFonts(); },
    setRead: (fn) => { read = fn; },
    setFonts: (value) => { fontResult = value; },
  };
}

test("saved Sinhala loads independently of fonts; loading/failure never hides the app", async () => {
  const env = setup("si"); env.render(); await tick(); env.render();
  assert.equal(env.useLanguage().language, "si");
  for (const result of [[false, null], [false, Error("font failed")], [true, null]]) {
    env.setFonts(result); env.render();
    const node = env.native(env.LocalizedText, { children: [env.useLanguage().t("welcome.heading")] });
    assert.equal(flatten(node.props.style).fontFamily, result[0] ? "NotoSansSinhala-Regular" : undefined);
    assert.equal(node.props.children[0], env.useLanguage().t("welcome.heading"));
  }
});

test("Sinhala static Regular/Bold selection preserves accessibility, scaling and refs", async () => {
  const env = setup(); env.setFonts([true, null]); env.render();
  await env.useLanguage().setLanguage("si"); env.render();
  for (const [weight, family] of [["400", "Regular"], ["700", "Bold"]]) {
    const ref = {}, press = () => {};
    const node = env.native(env.LocalizedText, { style: { fontSize: 23, fontWeight: weight }, accessibilityLabel: "label", onPress: press }, ref);
    assert.equal(flatten(node.props.style).fontFamily, `NotoSansSinhala-${family}`);
    assert.equal(flatten(node.props.style).fontWeight, "normal");
    assert.equal(node.props.accessibilityLabel, "label"); assert.equal(node.props.onPress, press);
    assert.equal(node.props.allowFontScaling, true); assert.equal(node.props.ref, ref);
  }
});

test("switching locale preserves native TextInput type, values, selection and handlers", async () => {
  const env = setup(); env.setFonts([true, null]); env.render();
  const onChangeText = () => {}, ref = {}, selection = { start: 2, end: 2 };
  const props = { value: "unchanged-value", onChangeText, selection, secureTextEntry: true, style: { height: 49, fontSize: 13 } };
  for (const locale of ["en", "si", "en"]) {
    await env.useLanguage().setLanguage(locale); env.render();
    const node = env.native(env.LocalizedTextInput, props, ref), style = flatten(node.props.style);
    assert.equal(node.type, "TextInput"); assert.equal(node.props.value, props.value);
    assert.equal(node.props.selection, selection); assert.equal(node.props.onChangeText, onChangeText);
    assert.equal(node.props.ref, ref); assert.equal(node.props.secureTextEntry, true);
    assert.equal(style.fontFamily, locale === "si" ? "NotoSansSinhala-Regular" : undefined);
    assert.equal(style.height, locale === "si" ? undefined : 49);
    if (locale === "en") assert.equal(node.props.style, props.style);
  }
  assert.deepEqual(env.writes, ["en", "si", "en"]);
});

test("English style objects remain unchanged while fonts load or fail", () => {
  const env = setup(); env.render(); const style = { fontWeight: "800", fontSize: 27 };
  for (const result of [[false, null], [true, null], [false, Error("font failed")]]) {
    env.setFonts(result); env.render();
    assert.equal(env.native(env.LocalizedText, { style }).props.style, style);
  }
});

test("late saved-language read cannot overwrite a selection while fonts finish loading", async () => {
  const env = setup(); let finish;
  env.setRead(() => new Promise((resolve) => { finish = resolve; }));
  env.render(); await env.useLanguage().setLanguage("en");
  finish("si"); env.setFonts([true, null]); await tick(); env.render();
  assert.equal(env.useLanguage().language, "en");
  assert.equal(flatten(env.native(env.LocalizedText, {}).props.style).fontFamily, undefined);
});
