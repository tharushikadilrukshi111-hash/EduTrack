
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

const students = [
  {
    id: "1",
    name: "Student A",
    registrationNo: "ET-2026-001",
  },
  {
    id: "2",
    name: "Student B",
    registrationNo: "ET-2026-002",
  },
];

export default function StudentListScreen({ onAddStudent }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Student Management</Text>

      <Text style={styles.subtitle}>
        Manage your registered students
      </Text>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.regNo}>
              {item.registrationNo}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={onAddStudent}
      >
        <Text style={styles.buttonText}>
          + Add New Student
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
  name: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#173B64",
  },
  regNo: {
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
