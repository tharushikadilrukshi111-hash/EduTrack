import React, { createContext, forwardRef, useContext } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { useFonts } from "expo-font";

const FONT_ASSETS = {
  "NotoSansSinhala-Regular": require("../assets/fonts/NotoSansSinhala-Regular.ttf"),
  "NotoSansSinhala-Bold": require("../assets/fonts/NotoSansSinhala-Bold.ttf"),
};

const SinhalaFontContext = createContext(false);

// Always render children: loading or failed fonts must not delay authentication.
export function SinhalaFontProvider({ children }) {
  const [loaded, error] = useFonts(FONT_ASSETS);
  return (
    <SinhalaFontContext.Provider value={Boolean(loaded && !error)}>
      {children}
    </SinhalaFontContext.Provider>
  );
}

function useSinhalaStyle(style, weight, enabled) {
  const ready = useContext(SinhalaFontContext);
  if (!enabled) return style;
  const bold = weight === "bold";
  return [styles.text, style, {
    fontFamily: ready ? (bold ? "NotoSansSinhala-Bold" : "NotoSansSinhala-Regular") : undefined,
    // Select the static face explicitly; avoid synthetic weight/style selection.
    fontWeight: ready ? "normal" : (bold ? "700" : "400"),
    fontStyle: "normal",
  }];
}

// Opt in only for Sinhala content. Native props, accessibility, and refs pass through.
// weight: "regular" (default) or "bold". Avoid tight lineHeight/fixed-height styles.
export const SinhalaText = forwardRef(function SinhalaText(
  { style, weight = "regular", enabled = true, allowFontScaling = true, ...props }, ref,
) {
  const textStyle = useSinhalaStyle(style, weight, enabled);
  return <Text {...props} ref={ref} allowFontScaling={allowFontScaling} style={textStyle} />;
});

export const SinhalaTextInput = forwardRef(function SinhalaTextInput(
  { style, weight = "regular", enabled = true, allowFontScaling = true, ...props }, ref,
) {
  const textStyle = useSinhalaStyle(style, weight, enabled);
  return <TextInput {...props} ref={ref} allowFontScaling={allowFontScaling} style={textStyle} />;
});

const styles = StyleSheet.create({ text: { fontSize: 16 } });
