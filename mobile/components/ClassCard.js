import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { LocalizedText } from "./LocalizedTypography";

// Presentation fields, independent of any future API response format.
export default function ClassCard({ classInfo, onPress }) {
  const { t } = useLanguage();
  const { name, subject, teacherName, scheduleLabel } = classInfo;
  const selectable = typeof onPress === "function";
  const Container = selectable ? Pressable : View;
  return (
    <Container
      style={styles.card}
      {...(selectable ? {
        onPress,
        accessibilityRole: "button",
        accessibilityLabel: t("student.classAction", { name }),
        accessibilityHint: t("student.classActionHint"),
      } : {})}
    >
      {!!subject && <LocalizedText style={styles.subject}>{subject}</LocalizedText>}
      <LocalizedText style={styles.name}>{name}</LocalizedText>
      {!!teacherName && <LocalizedText style={styles.detail}>{t("student.teacherName", { name: teacherName })}</LocalizedText>}
      {!!scheduleLabel && <LocalizedText style={styles.detail}>{scheduleLabel}</LocalizedText>}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1,
    borderColor: "#DEE7EF", padding: 17, marginBottom: 13,
  },
  subject: { color: "#078692", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  name: { color: "#173B64", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  detail: { color: "#718198", fontSize: 13, lineHeight: 21 },
});
