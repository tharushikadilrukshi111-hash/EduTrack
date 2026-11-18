import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { LocalizedText, LocalizedTextInput } from "./LocalizedTypography";
import LanguageSwitcher from "./LanguageSwitcher";

const COLORS = {
  canvas: "#F4F7FB",
  ink: "#142E4D",
  navy: "#123C68",
  teal: "#087F8C",
  muted: "#607084",
  border: "#DDE5EF",
  white: "#FFFFFF",
};

const FILTERS = ["All", "Downloaded"];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidMaterialList(materials) {
  if (!Array.isArray(materials)) return false;

  const ids = new Set();
  for (const material of materials) {
    if (
      !material ||
      typeof material !== "object" ||
      Array.isArray(material) ||
      !hasText(material.id) ||
      !hasText(material.title) ||
      ids.has(material.id)
    ) {
      return false;
    }
    ids.add(material.id);
  }
  return true;
}

function MaterialCard({ material, onView, onDownload }) {
  const { t } = useLanguage();
  const canView = typeof onView === "function";
  const canDownload = typeof onDownload === "function";
  const metadata = [
    hasText(material.fileType) && material.fileType.trim().toUpperCase(),
    hasText(material.fileSizeLabel) && material.fileSizeLabel.trim(),
    hasText(material.updatedDateLabel) && t("materials.updated", { date: material.updatedDateLabel.trim() }),
  ].filter(Boolean).join(" · ");

  function openActions() {
    if (canView && canDownload) {
      Alert.alert(material.title, t("materials.chooseAction"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("materials.view"), onPress: () => onView(material) },
        { text: t("materials.download"), onPress: () => onDownload(material) },
      ], { cancelable: true });
    } else if (canView) {
      onView(material);
    } else if (canDownload) {
      onDownload(material);
    }
  }

  const actionLabel = t(canView && canDownload ? "materials.readOrDownload" : canView ? "materials.view" : "materials.download");

  return (
    <View style={styles.card}>
      <LocalizedText style={styles.label}>{material.title}</LocalizedText>
      {!!metadata && <LocalizedText style={styles.metadata}>{metadata}</LocalizedText>}
      {(canView || canDownload) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${material.title}`}
          hitSlop={10}
          onPress={openActions}
          style={styles.action}
        >
          <LocalizedText style={styles.actionText}>{actionLabel} →</LocalizedText>
        </Pressable>
      )}
      {(!canView || !canDownload) && (
        <LocalizedText style={styles.caption}>
          {t(canView ? "materials.downloadUnavailable" : canDownload ? "materials.viewUnavailable" : "materials.actionsUnavailable")}
        </LocalizedText>
      )}
    </View>
  );
}

// The caller supplies display metadata and updates downloadedMaterialIds after saving a file.
// Materials require unique string IDs and titles. Optional labels are already formatted.
export default function LearningMaterialsScreen({
  selectedClass = null,
  materials = null,
  status = materials == null ? "idle" : "success",
  downloadedMaterialIds = [],
  onBack,
  onView,
  onDownload,
  onRetry,
} = {}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const className = [selectedClass?.subject, selectedClass?.name].find(hasText);
  const grade = selectedClass?.grade;
  const gradeLabel = Number.isFinite(grade) ? t("materials.grade", { grade }) : hasText(grade) ? grade.trim() : "";
  const classLabel = [className?.trim(), gradeLabel].filter(Boolean).join(" · ");
  const canGoBack = typeof onBack === "function";
  const canRetry = typeof onRetry === "function";

  const downloadedIds = new Set(Array.isArray(downloadedMaterialIds) ? downloadedMaterialIds : []);
  const search = query.trim().toLowerCase();
  const validList = status === "success" && isValidMaterialList(materials);
  const filteredMaterials = validList
    ? materials.filter((material) => filter === "All" || downloadedIds.has(material.id))
    : [];
  const visibleMaterials = filteredMaterials.filter((material) =>
    [material.title, material.description].some(
      (value) => hasText(value) && value.toLowerCase().includes(search),
    ),
  );

  let emptyMessage;
  const failed = status === "error" || (status === "success" && !validList);
  if (status === "loading") {
    emptyMessage = t("materials.loading");
  } else if (failed) {
    emptyMessage = t("materials.error");
  } else if (!validList) {
    emptyMessage = t("materials.unavailable");
  } else if (filteredMaterials.length === 0) {
    emptyMessage = filter === "Downloaded"
      ? t("materials.noDownloads")
      : t("materials.empty");
  } else {
    emptyMessage = t("materials.noMatches");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(canGoBack ? "common.back" : "materials.backUnavailable")}
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={canGoBack ? onBack : undefined}
          style={styles.back}
        >
          <LocalizedText style={[styles.chevron, !canGoBack && styles.disabledChevron]}>‹</LocalizedText>
        </Pressable>
        <View style={styles.heading}>
          {!!classLabel && <LocalizedText style={styles.classLabel}>{classLabel}</LocalizedText>}
          <LocalizedText accessibilityRole="header" style={styles.title}>{t("materials.title")}</LocalizedText>
        </View>
      </View>
      <FlatList
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        data={visibleMaterials}
        keyExtractor={(material) => material.id}
        renderItem={({ item }) => (
          <MaterialCard material={item} onView={onView} onDownload={onDownload} />
        )}
        ListHeaderComponent={(
          <View>
            <LanguageSwitcher />
            <LocalizedText style={styles.label}>{t("materials.search")}</LocalizedText>
            <LocalizedTextInput
              accessibilityLabel={t("materials.search")}
              placeholder={t("materials.searchHint")}
              placeholderTextColor={COLORS.muted}
              autoCorrect={false}
              returnKeyType="search"
              style={styles.input}
              value={query}
              onChangeText={setQuery}
            />
            <View style={styles.filters}>
              {FILTERS.map((option) => {
                const selected = filter === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(option)}
                    style={[styles.filter, selected && styles.selectedFilter]}
                  >
                    <LocalizedText style={[styles.filterText, selected && styles.selectedFilterText]}>
                      {t(option === "All" ? "materials.all" : "materials.downloaded")}
                    </LocalizedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.card} accessibilityLiveRegion="polite">
            {status === "loading" && <ActivityIndicator color={COLORS.teal} />}
            <LocalizedText style={styles.metadata}>{emptyMessage}</LocalizedText>
            {failed && canRetry && (
              <Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}>
                <LocalizedText style={styles.actionText}>{t("common.retry")}</LocalizedText>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 90,
  },
  back: { minWidth: 44, minHeight: 48, justifyContent: "center" },
  chevron: { fontSize: 30, color: COLORS.teal },
  disabledChevron: { color: COLORS.muted },
  heading: { flex: 1, gap: 4 },
  classLabel: { color: COLORS.teal, fontSize: 12, fontWeight: "500", textTransform: "uppercase" },
  title: { color: COLORS.ink, fontSize: 26, fontWeight: "700", lineHeight: 34 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  label: { color: COLORS.ink, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  input: {
    marginTop: 6,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: COLORS.ink,
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 15,
  },
  filters: { flexDirection: "row", gap: 8, marginTop: 40, marginBottom: 16 },
  filter: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  selectedFilter: { backgroundColor: COLORS.navy },
  filterText: { color: COLORS.muted, fontWeight: "700", textAlign: "center" },
  selectedFilterText: { color: COLORS.white },
  card: {
    gap: 4,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  metadata: { color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  caption: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  action: { alignSelf: "flex-start", justifyContent: "center", minHeight: 24 },
  actionText: { color: COLORS.teal, fontSize: 12, fontWeight: "600", lineHeight: 18 },
});
