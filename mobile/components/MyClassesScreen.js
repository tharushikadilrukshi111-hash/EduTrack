import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ClassCard from "./ClassCard";

// UI props only; enrolled-class data will be connected when its API is available.
export default function MyClassesScreen({ classes = [], onBack }) {
  return (
    <View>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>‹ Student dashboard</Text>
      </TouchableOpacity>
      <Text style={styles.tag}>EDUTRACK</Text>
      <Text style={styles.title} accessibilityRole="header">My Classes</Text>
      <Text style={styles.description}>Your enrolled classes, all in one place.</Text>
      {classes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No classes to display</Text>
          <Text style={styles.emptyText}>
            Enrolled classes are not connected yet. Your classes will appear here once this feature is available.
          </Text>
        </View>
      ) : (
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
});
