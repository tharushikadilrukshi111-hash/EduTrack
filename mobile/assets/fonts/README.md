# Noto Sans Sinhala

Unmodified static hinted TrueType fonts from the official [Noto Sinhala project](https://notofonts.github.io/sinhala/), downloaded 2026-11-18 for the EDU-63 test preview.

Sources:

- https://notofonts.github.io/sinhala/fonts/NotoSansSinhala/hinted/ttf/NotoSansSinhala-Regular.ttf
- https://notofonts.github.io/sinhala/fonts/NotoSansSinhala/hinted/ttf/NotoSansSinhala-Bold.ttf
- License: https://raw.githubusercontent.com/notofonts/sinhala/main/OFL.txt

Copyright 2022 The Noto Project Authors (https://github.com/notofonts/sinhala).
Licensed under the SIL Open Font License 1.1; the complete upstream copyright and license text is included in [OFL.txt](OFL.txt). Keep that notice and license with redistributed fonts. The upstream HEAD download paths can change; hashes below identify these exact files.

| File | Bytes | SHA-256 |
|---|---|---|
| NotoSansSinhala-Regular.ttf | 149472 | `be1a3ddb8cadb16e603ca08853d7d4f086e390150610127a5b711ac4b00078e2` |
| NotoSansSinhala-Bold.ttf | 183156 | `5e7f3a5f1a1512a5983f37da07b1f6b07814dd775650be561a9319f4b041a940` |

Verified TrueType headers, table bounds, whole-file checksums, internal family/style names, static weights 400/700, and presence of Sinhala shaping tables. These checks do not establish correct device rendering. Runtime aliases: NotoSansSinhala-Regular and NotoSansSinhala-Bold.

## Application usage

`App` wraps its UI in `SinhalaFontProvider` from `mobile/components/SinhalaTypography.js`. The provider loads both bundled faces with `useFonts` and always renders children. While loading or if loading fails, the opt-in wrappers use the system font. Existing English Text and TextInput elements are unchanged.

Import `SinhalaText` and `SinhalaTextInput` for future Sinhala content. Use `weight="regular"` (default) or `weight="bold"`; wrappers select the matching face and override conflicting fontFamily/fontWeight/fontStyle styles. Native props, refs, accessibility, and callbacks pass through. Font scaling defaults to enabled. Use flexible layouts and avoid restrictive lineHeight or fixed heights that clip vowel marks.

These wrappers do not translate labels, add language switching, or implement materials/quiz screens. The temporary comparison preview has been removed. Android baseline/comparison rendering was user-confirmed; production regression and iOS verification remain separate checks.
