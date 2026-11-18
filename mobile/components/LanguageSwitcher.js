import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function selectLanguage(code) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      const saved = await setLanguage(code);
      if (mounted.current) setSaveFailed(!saved);
    } catch {
      if (mounted.current) setSaveFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t("language.label")}</Text>
      <View style={styles.options}>
        {["en", "si"].map((code) => (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityLabel={t(code === "en" ? "language.english" : "language.sinhala")}
            accessibilityState={{ selected: language === code, disabled: saving, busy: saving }}
            disabled={saving}
            onPress={() => selectLanguage(code)}
            style={[styles.option, language === code && styles.selected, saving && styles.saving]}
          >
            <Text style={[styles.text, language === code && styles.selectedText]}>
              {t(code === "en" ? "language.english" : "language.sinhala")}
            </Text>
          </Pressable>
        ))}
      </View>
      {saveFailed && <Text style={styles.error} accessibilityLiveRegion="polite">{t("language.saveFailure")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: { color: "#173B64", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 48, minWidth: 96, justifyContent: "center", alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#078692", borderRadius: 10 },
  selected: { backgroundColor: "#078692" },
  text: { color: "#078692", fontSize: 16, fontWeight: "700" },
  selectedText: { color: "#FFFFFF" },
  saving: { opacity: 0.7 },
  error: { color: "#B52C40", fontSize: 13, marginTop: 8 },
});
