import React, { forwardRef } from "react";
import { StyleSheet } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { SinhalaText, SinhalaTextInput } from "./SinhalaTypography";

function weightFor(style, weight) {
  if (weight) return weight;
  const value = StyleSheet.flatten(style)?.fontWeight;
  return value === "bold" || Number(value) >= 600 ? "bold" : "regular";
}

export const LocalizedText = forwardRef(function LocalizedText({ style, weight, ...props }, ref) {
  const { language } = useLanguage();
  return (
    <SinhalaText {...props} ref={ref} style={style} weight={weightFor(style, weight)} enabled={language === "si"} />
  );
});

export const LocalizedTextInput = forwardRef(function LocalizedTextInput({ style, weight, ...props }, ref) {
  const { language } = useLanguage();
  const sinhala = language === "si";
  return (
    <SinhalaTextInput
      {...props}
      ref={ref}
      style={sinhala ? [style, styles.sinhalaInput] : style}
      weight={weightFor(style, weight)}
      enabled={sinhala}
    />
  );
});

// Stable wrapper/native types preserve input focus and values across locale changes.
const styles = StyleSheet.create({ sinhalaInput: { height: undefined, minHeight: 49, paddingVertical: 12 } });
