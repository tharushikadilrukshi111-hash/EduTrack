import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { LocalizedText } from "./LocalizedTypography";
import LanguageSwitcher from "./LanguageSwitcher";

export default function StudentDashboard({ student, onLogout, onMyClasses, onMyQRCard, onLearningMaterials }) {
  const { t } = useLanguage();
  return (
    <View>
      <LanguageSwitcher />
      <Text style={styles.tag}>EDUTRACK</Text>
      <LocalizedText style={styles.bigTitle}>{t("dashboard.student")}</LocalizedText>
      <LocalizedText style={styles.muted}>
        {t("dashboard.welcome", { name: student?.name || t("dashboard.defaultUser") })}
      </LocalizedText>
      <View style={styles.roleCard}>
        <LocalizedText style={styles.cardTitle}>✓ {t("dashboard.loginSuccessful")}</LocalizedText>
        <LocalizedText style={styles.muted}>{t("dashboard.comingSoon")}</LocalizedText>
      </View>
      <TouchableOpacity onPress={onMyClasses} style={styles.button} accessibilityRole="button">
        <LocalizedText style={styles.buttonText}>{t("student.myClasses")}</LocalizedText>
      </TouchableOpacity>
      <TouchableOpacity onPress={onMyQRCard} style={styles.button} accessibilityRole="button">
        <LocalizedText style={styles.buttonText}>{t("student.myQRCard")}</LocalizedText>
      </TouchableOpacity>
      <TouchableOpacity onPress={onLearningMaterials} disabled={typeof onLearningMaterials !== "function"} style={styles.button} accessibilityRole="button">
        <LocalizedText style={styles.buttonText}>{t("materials.title")}</LocalizedText>
      </TouchableOpacity>
      <TouchableOpacity onPress={onLogout} style={styles.button} accessibilityRole="button">
        <LocalizedText style={styles.buttonText}>{t("dashboard.logout")}</LocalizedText>
      </TouchableOpacity>
    </View>
  );
}

const BLUE = "#173B64";
const TEAL = "#078692";

const styles = StyleSheet.create({
  tag: {
    color: TEAL,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10,
  },
  bigTitle: {
    color: BLUE,
    fontSize: 27,
    fontWeight: "800",
    marginBottom: 12,
  },
  muted: {
    color: "#718198",
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 18,
  },
  roleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DEE7EF",
    padding: 17,
    marginBottom: 13,
  },
  cardTitle: {
    color: BLUE,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  button: {
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 9,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
