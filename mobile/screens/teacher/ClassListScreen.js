
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

// Sample data for testing the UI
const classes = [
  {
    id: "1",
    name: "Grade 10 Mathematics",
    subject: "Mathematics",
  },
  {
    id: "2",
    name: "Grade 11 Science",
    subject: "Science",
  },
];

export default function ClassListScreen({ onAddClass }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Class Management</Text>

      <Text style={styles.subtitle}>
        View and manage your classes
      </Text>

      <FlatList
        data={classes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.className}>{item.name}</Text>
            <Text style={styles.subject}>
              Subject: {item.subject}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={onAddClass}
      >
        <Text style={styles.buttonText}>
          + Create New Class
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F4F7FB",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#173B64",
  },
  subtitle: {
    fontSize: 14,
    color: "#718198",
    marginTop: 8,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DEE7EF",
  },
  className: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#173B64",
  },
  subject: {
    fontSize: 13,
    color: "#718198",
    marginTop: 6,
  },
  button: {
    backgroundColor: "#078692",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
