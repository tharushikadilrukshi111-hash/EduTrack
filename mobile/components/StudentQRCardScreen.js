import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { LocalizedText } from "./LocalizedTypography";
import LanguageSwitcher from "./LanguageSwitcher";

export default function StudentQRCardScreen({ student, onBack }) {
  const { t } = useLanguage();
  return (
    <View>
      <LanguageSwitcher />
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.back}>
        <LocalizedText style={styles.backText}>‹ {t("student.back")}</LocalizedText>
      </TouchableOpacity>
      <LocalizedText style={styles.title} accessibilityRole="header">{t("student.myQRCard")}</LocalizedText>
      <LocalizedText style={styles.description}>{t("student.cardDescription")}</LocalizedText>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.brand}>EDUTRACK</Text>
          <LocalizedText style={styles.cardType}>{t("student.cardType")}</LocalizedText>
        </View>
        <View style={styles.cardBody}>
          <LocalizedText style={styles.label}>{t("student.nameLabel")}</LocalizedText>
          <Text style={styles.name}>{student?.name || t("student.nameUnavailable")}</Text>
          <LocalizedText style={styles.label}>{t("student.registrationLabel")}</LocalizedText>
          <Text style={styles.identifier}>{student?.identifier || t("student.identifierUnavailable")}</Text>

          <View style={styles.qrPlaceholder}>
            <LocalizedText style={styles.placeholderTitle}>{t("student.qrUnavailable")}</LocalizedText>
            <LocalizedText style={styles.placeholderText}>{t("student.qrHint")}</LocalizedText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: "center", marginBottom: 12 },
  backText: { color: "#078692", fontSize: 14, fontWeight: "700" },
  title: { color: "#173B64", fontSize: 27, fontWeight: "800", marginBottom: 12 },
  description: { color: "#718198", fontSize: 13, lineHeight: 21, marginBottom: 24 },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1,
    borderColor: "#DEE7EF", overflow: "hidden",
  },
  cardHeader: { backgroundColor: "#173B64", padding: 20 },
  brand: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  cardType: { color: "#E0F1FA", fontSize: 11, fontWeight: "700" },
  cardBody: { padding: 20 },
  label: { color: "#078692", fontSize: 11, fontWeight: "700", marginBottom: 8 },
  name: { color: "#173B64", fontSize: 22, fontWeight: "800", marginBottom: 20 },
  identifier: { color: "#173B64", fontSize: 16, fontWeight: "700", marginBottom: 24 },
  qrPlaceholder: {
    width: "100%", maxWidth: 260, alignSelf: "center", minHeight: 200,
    borderWidth: 1, borderStyle: "dashed", borderColor: "#DEE7EF",
    backgroundColor: "#F4F7FB", borderRadius: 12, padding: 20, justifyContent: "center",
  },
  placeholderTitle: {
    color: "#173B64", fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 10,
  },
  placeholderText: { color: "#718198", fontSize: 13, lineHeight: 21, textAlign: "center" },
});
