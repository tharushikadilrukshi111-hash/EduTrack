import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ClassCard from "./ClassCard";
import { useLanguage } from "../context/LanguageContext";
import { LocalizedText } from "./LocalizedTypography";
import LanguageSwitcher from "./LanguageSwitcher";
import { isValidClassList } from "../api/studentClasses";

export default function MyClassesScreen({ classes, status = "loading", errorKey, onBack, onRetry, onSelectClass }) {
  const { t } = useLanguage();
  const invalidData = status === "success" && !isValidClassList(classes);
  const displayStatus = invalidData ? "error" : status;
  return (
    <View>
      <LanguageSwitcher />
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.back}>
        <LocalizedText style={styles.backText}>‹ {t("student.back")}</LocalizedText>
      </TouchableOpacity>
      <Text style={styles.tag}>EDUTRACK</Text>
      <LocalizedText style={styles.title} accessibilityRole="header">{t("student.myClasses")}</LocalizedText>
      <LocalizedText style={styles.description}>{t("student.classesDescription")}</LocalizedText>
      {displayStatus === "loading" && (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <ActivityIndicator color="#078692" accessibilityLabel={t("student.classesLoading")} />
          <LocalizedText style={[styles.emptyText, styles.loadingText]}>{t("student.classesLoading")}</LocalizedText>
        </View>
      )}
      {displayStatus === "error" && (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <LocalizedText style={styles.emptyTitle}>{t("student.classesError")}</LocalizedText>
          <LocalizedText style={styles.emptyText}>
            {invalidData
              ? t("student.classesInvalid")
              : t(errorKey || "student.connectionError")}
          </LocalizedText>
          {typeof onRetry === "function" && (
            <TouchableOpacity onPress={onRetry} accessibilityRole="button" style={styles.retry}>
              <LocalizedText style={styles.retryText}>{t("common.retry")}</LocalizedText>
            </TouchableOpacity>
          )}
        </View>
      )}
      {displayStatus === "success" && classes.length === 0 && (
        <View style={styles.empty}>
          <LocalizedText style={styles.emptyTitle}>{t("student.noEnrollments")}</LocalizedText>
          <LocalizedText style={styles.emptyText}>{t("student.enrollmentHint")}</LocalizedText>
        </View>
      )}
      {displayStatus === "success" && classes.length > 0 && (
        classes.map((classItem) => (
          <ClassCard
            key={classItem.id}
            classInfo={classItem}
            onPress={typeof onSelectClass === "function" ? () => onSelectClass(classItem) : undefined}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 48, justifyContent: "center", marginBottom: 12 },
  backText: { color: "#078692", fontSize: 14, fontWeight: "700" },
  tag: { color: "#078692", fontSize: 11, fontWeight: "700", marginBottom: 10 },
  title: { color: "#173B64", fontSize: 27, fontWeight: "800", marginBottom: 12 },
  description: { color: "#718198", fontSize: 13, lineHeight: 21, marginBottom: 24 },
  empty: {
    backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1,
    borderColor: "#DEE7EF", padding: 24,
  },
  emptyTitle: { color: "#173B64", fontSize: 18, fontWeight: "700", marginBottom: 10 },
  emptyText: { color: "#718198", fontSize: 14, lineHeight: 22 },
  loadingText: { textAlign: "center", marginTop: 12 },
  retry: {
    backgroundColor: "#078692", borderRadius: 10, minHeight: 48,
    paddingVertical: 16, paddingHorizontal: 20, alignItems: "center", marginTop: 16,
  },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
