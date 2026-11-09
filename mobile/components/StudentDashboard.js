import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function StudentDashboard({ student, onLogout }) {
  return (
    <View>
      <Text style={styles.tag}>EDUTRACK</Text>
      <Text style={styles.bigTitle}>Student dashboard</Text>
      <Text style={styles.muted}>
        Welcome, {student?.name || "EduTrack user"}!
      </Text>
      <View style={styles.roleCard}>
        <Text style={styles.cardTitle}>✓ Login successful</Text>
        <Text style={styles.muted}>
          Your full dashboard will be built next.
        </Text>
      </View>
      <TouchableOpacity onPress={onLogout} style={styles.button}>
        <Text style={styles.buttonText}>Log out</Text>
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
