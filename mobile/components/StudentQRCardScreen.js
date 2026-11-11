import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function StudentQRCardScreen({ student, onBack }) {
  return (
    <View>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>‹ Student dashboard</Text>
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header">My QR Card</Text>
      <Text style={styles.description}>Your EduTrack student identity card.</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.brand}>EDUTRACK</Text>
          <Text style={styles.cardType}>STUDENT IDENTITY</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.label}>STUDENT NAME</Text>
          <Text style={styles.name}>{student?.name || "Name unavailable"}</Text>
          <Text style={styles.label}>REGISTRATION IDENTIFIER</Text>
          <Text style={styles.identifier}>{student?.identifier || "Identifier unavailable"}</Text>

          <View style={styles.qrPlaceholder}>
            <Text style={styles.placeholderTitle}>QR code not available yet</Text>
            <Text style={styles.placeholderText}>
              Your QR code will appear here when this feature is available.
            </Text>
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
