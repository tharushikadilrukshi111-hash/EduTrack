import { I18n } from "i18n-js";
import en from "./en";
import si from "./si";

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = Object.freeze(["en", "si"]);

export function isSupportedLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

// Separate instances avoid one provider changing another provider's locale.
export function createI18n(language = DEFAULT_LANGUAGE) {
  if (!isSupportedLanguage(language)) throw new RangeError("Unsupported language");
  return new I18n({ en, si }, {
    locale: language,
    defaultLocale: DEFAULT_LANGUAGE,
    enableFallback: true,
  });
}
