import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ClassCard from "./ClassCard";

// Validate presentation data without treating missing or malformed results as empty.
export function isValidClassList(classes) {
  if (!Array.isArray(classes)) return false;
  const ids = new Set();
  for (const item of classes) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    if (typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) return false;
    if (typeof item.name !== "string" || !item.name.trim()) return false;
    for (const field of ["subject", "teacherName", "scheduleLabel"]) {
      if (item[field] != null && typeof item[field] !== "string") return false;
    }
    ids.add(item.id);
  }
  return true;
}

// UI props only; enrolled-class data will be connected when its API is available.
// status: idle (not connected), loading, success, or error.
export default function MyClassesScreen({ classes, status = "idle", onBack, onRetry }) {
  const invalidData = status === "success" && !isValidClassList(classes);
  const displayStatus = invalidData ? "error" : status;
  return (
    <View>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>‹ Student dashboard</Text>
      </TouchableOpacity>
      <Text style={styles.tag}>EDUTRACK</Text>
      <Text style={styles.title} accessibilityRole="header">My Classes</Text>
      <Text style={styles.description}>Your enrolled classes, all in one place.</Text>
      {displayStatus === "idle" && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No classes to display</Text>
          <Text style={styles.emptyText}>
            Enrolled classes are not connected yet. Your classes will appear here once this feature is available.
          </Text>
        </View>
      )}
      {displayStatus === "loading" && (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <ActivityIndicator color="#078692" accessibilityLabel="Loading enrolled classes" />
          <Text style={[styles.emptyText, styles.loadingText]}>Loading your classes...</Text>
        </View>
      )}
      {displayStatus === "error" && (
        <View style={styles.empty} accessibilityLiveRegion="polite">
          <Text style={styles.emptyTitle}>Could not load your classes</Text>
          <Text style={styles.emptyText}>
            {invalidData
              ? "The class information could not be displayed. Please try again."
              : "Please check your connection and try again."}
          </Text>
          {typeof onRetry === "function" && (
            <TouchableOpacity onPress={onRetry} accessibilityRole="button" style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {displayStatus === "success" && classes.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No enrolled classes yet</Text>
          <Text style={styles.emptyText}>Your classes will appear here once you are enrolled.</Text>
        </View>
      )}
      {displayStatus === "success" && classes.length > 0 && (
        classes.map((classItem) => <ClassCard key={classItem.id} classInfo={classItem} />)
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
