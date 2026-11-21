import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { createI18n, DEFAULT_LANGUAGE, isSupportedLanguage } from "../localization/i18n";

export const LANGUAGE_STORAGE_KEY = "edutrack_language";
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, updateLanguage] = useState(DEFAULT_LANGUAGE);
  const selectionVersion = useRef(0);
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    async function restoreLanguage() {
      try {
        const saved = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        if (active && selectionVersion.current === 0 && isSupportedLanguage(saved)) {
          updateLanguage(saved);
        }
      } catch {
        // An unavailable preference store must not block the app or authentication.
      }
    }
    restoreLanguage();
    return () => { active = false; };
  }, []);

  // Returns Promise<boolean>: false for unsupported codes or failed persistence.
  // A supported selection updates the UI immediately, even when saving fails.
  const setLanguage = useCallback((nextLanguage) => {
    if (!isSupportedLanguage(nextLanguage)) return Promise.resolve(false);
    selectionVersion.current += 1;
    updateLanguage(nextLanguage);
    // Serialize writes so rapid selections cannot persist out of order.
    const write = writeQueue.current.then(async () => {
      try {
        await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, nextLanguage);
        return true;
      } catch {
        return false;
      }
    });
    writeQueue.current = write;
    return write;
  }, []);

  const translator = useMemo(() => createI18n(language), [language]);
  const t = useCallback((key, params = {}) => (
    translator.t(key, { ...params, locale: language })
  ), [translator, language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}
