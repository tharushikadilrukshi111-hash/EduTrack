
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { getStudents } from "../../api/teacherStudents";

export default function StudentListScreen({ onAddStudent }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStudents(query = "") {
    setLoading(true);
    setError("");

    try {
      const data = await getStudents(query);

      if (!Array.isArray(data)) {
        throw new Error("Unexpected student list response.");
      }

      setStudents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Student Management</Text>

      <Text style={styles.subtitle}>
        Manage your registered students
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Search registration number"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="characters"
      />

      <TouchableOpacity
        style={styles.button}
        disabled={loading}
        onPress={() => loadStudents(search)}
      >
        <Text style={styles.buttonText}>Search</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          setSearch("");
          loadStudents();
        }}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Show All Students</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator color="#078692" />}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        style={{ flex: 1 }}
        data={students}
        keyExtractor={(item) =>
          String(item.id || item._id || item.registrationNumber)
        }
        refreshing={loading}
        onRefresh={() => loadStudents(search)}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.subtitle}>No students found.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>
              {item.name || item.user?.name || "Student"}
            </Text>

            <Text style={styles.subtitle}>
              {item.registrationNumber}
            </Text>

            <Text style={styles.subtitle}>
              {item.email || item.user?.email || "No email"}
            </Text>

            <Text style={styles.subtitle}>
              {item.phone || "No phone"}
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
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 10,
    padding: 14,
    marginTop: 15,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#173B64",
  },
  subtitle: {
    color: "#718198",
    marginTop: 5,
  },
  button: {
    backgroundColor: "#078692",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  error: {
    color: "#B52C40",
    marginVertical: 10,
  },
});
