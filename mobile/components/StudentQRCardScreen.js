import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { LocalizedText } from "./LocalizedTypography";
import LanguageSwitcher from "./LanguageSwitcher";

export default function StudentQRCardScreen({ status, student, qrImage, errorKey, onBack, onRetry, onImageError }) {
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
        {status === "success" && <View style={styles.cardBody}>
          <LocalizedText style={styles.label}>{t("student.nameLabel")}</LocalizedText>
          <LocalizedText style={styles.name}>{student.name}</LocalizedText>
          <LocalizedText style={styles.label}>{t("student.registrationLabel")}</LocalizedText>
          <LocalizedText style={styles.identifier}>{student.registrationNumber}</LocalizedText>

          <View style={styles.qrFrame}>
            <Image
              accessible
              accessibilityRole="image"
              accessibilityLabel={t("student.qrImageLabel")}
              source={{ uri: qrImage }}
              resizeMode="contain"
              resizeMethod="scale"
              fadeDuration={0}
              onError={onImageError}
              style={styles.qrImage}
            />
          </View>
        </View>}
        {status === "loading" && (
          <View style={styles.message} accessibilityLiveRegion="polite">
            <ActivityIndicator color="#078692" />
            <LocalizedText style={styles.messageText}>{t("student.qrLoading")}</LocalizedText>
          </View>
        )}
        {status === "error" && (
          <View style={styles.message} accessibilityLiveRegion="polite">
            <LocalizedText style={styles.errorTitle}>{t("student.qrError")}</LocalizedText>
            <LocalizedText style={styles.messageText}>{t(errorKey || "student.qrUnavailable")}</LocalizedText>
            <TouchableOpacity onPress={onRetry} accessibilityRole="button" style={styles.retry}>
              <LocalizedText style={styles.retryText}>{t("common.retry")}</LocalizedText>
            </TouchableOpacity>
          </View>
        )}
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
  qrFrame: {
    width: "100%", maxWidth: 300, alignSelf: "center", backgroundColor: "#FFFFFF", padding: 16,
  },
  qrImage: { width: "100%", aspectRatio: 1 },
  message: { padding: 24, gap: 10 },
  errorTitle: { color: "#173B64", fontSize: 16, fontWeight: "700" },
  messageText: { color: "#718198", fontSize: 13, lineHeight: 21 },
  retry: {
    backgroundColor: "#078692", borderRadius: 10, minHeight: 48, paddingHorizontal: 20,
    alignItems: "center", justifyContent: "center", marginTop: 6,
  },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
