import React from "react";
import { StyleSheet, Text, View } from "react-native";

// Presentation fields, independent of any future API response format.
export default function ClassCard({ classInfo }) {
  const { name, subject, teacherName, scheduleLabel } = classInfo;
  return (
    <View style={styles.card}>
      {!!subject && <Text style={styles.subject}>{subject}</Text>}
      <Text style={styles.name}>{name}</Text>
      {!!teacherName && <Text style={styles.detail}>Teacher: {teacherName}</Text>}
      {!!scheduleLabel && <Text style={styles.detail}>{scheduleLabel}</Text>}
    </View>
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
