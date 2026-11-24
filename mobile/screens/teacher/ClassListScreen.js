
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";

import {
  getClasses,
  enrollStudent,
  removeStudent,
  deleteClass,
} from "../../api/teacherClasses";

export default function ClassListScreen({ onAddClass }) {
  const [classes, setClasses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadClasses() {
    setLoading(true);
    setError("");

    try {
      const data = await getClasses();
      setClasses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  function replaceClass(updatedClass) {
    setClasses((previous) =>
      previous.map((item) =>
        item.id === updatedClass.id ? updatedClass : item
      )
    );
  }

  async function handleEnroll(classId) {
    if (!registrationNumber.trim()) {
      return Alert.alert("Error", "Enter registration number.");
    }

    setLoading(true);

    try {
      const data = await enrollStudent(
        classId,
        registrationNumber.trim().toUpperCase()
      );

      replaceClass(data.class);
      setRegistrationNumber("");

      Alert.alert("Success", "Student enrolled.");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRemove(classId, studentId) {
    Alert.alert(
      "Remove Student",
      "Remove this student from the class?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setLoading(true);

            try {
              const data = await removeStudent(classId, studentId);
              replaceClass(data.class);
            } catch (err) {
              Alert.alert("Error", err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  function handleDelete(classId) {
    Alert.alert(
      "Deactivate Class",
      "Are you sure you want to deactivate this class?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            setLoading(true);

            try {
              await deleteClass(classId);
              setClasses((previous) =>
                previous.filter((item) => item.id !== classId)
              );
              setSelectedId(null);
            } catch (err) {
              Alert.alert("Error", err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Class Management</Text>

      <Text style={styles.subtitle}>
        Manage your classes and students
      </Text>

      {loading && <ActivityIndicator color="#078692" />}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        style={{ flex: 1 }}
        data={classes}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={loadClasses}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.subtitle}>No classes found.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.subtitle}>
              Subject: {item.subject}
            </Text>
            <Text style={styles.subtitle}>
              Fee: Rs. {item.fee}
            </Text>
            <Text style={styles.subtitle}>
              Students: {item.studentCount}
            </Text>

            {!!item.description && (
              <Text style={styles.subtitle}>{item.description}</Text>
            )}

            <TouchableOpacity
              style={styles.button}
              disabled={loading}
              onPress={() => {
                setSelectedId(
                  selectedId === item.id ? null : item.id
                );
                setRegistrationNumber("");
              }}
            >
              <Text style={styles.buttonText}>
                {selectedId === item.id
                  ? "Close Details"
                  : "Manage Class"}
              </Text>
            </TouchableOpacity>

            {selectedId === item.id && (
              <View>
                <Text style={styles.name}>Enrol Student</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Registration number"
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={styles.button}
                  disabled={loading}
                  onPress={() => handleEnroll(item.id)}
                >
                  <Text style={styles.buttonText}>
                    Enrol Student
                  </Text>
                </TouchableOpacity>

                <Text style={styles.name}>Enrolled Students</Text>

                {(item.students || []).length === 0 && (
                  <Text style={styles.subtitle}>
                    No students enrolled.
                  </Text>
                )}

                {(item.students || []).map((student) => (
                  <View
                    key={student.id}
                    style={styles.studentCard}
                  >
                    <Text style={styles.name}>
                      {student.name || "Student"}
                    </Text>

                    <Text style={styles.subtitle}>
                      {student.registrationNumber}
                    </Text>

                    <TouchableOpacity
                      disabled={loading}
                      onPress={() =>
                        handleRemove(item.id, student.id)
                      }
                    >
                      <Text style={styles.error}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.deleteButton}
                  disabled={loading}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.buttonText}>
                    Deactivate Class
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={onAddClass}
      >
        <Text style={styles.buttonText}>+ Add New Class</Text>
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
    color: "#718198",
    marginVertical: 5,
  },
  name: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#173B64",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  studentCard: {
    backgroundColor: "#F4F7FB",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#078692",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 8,
  },
  deleteButton: {
    backgroundColor: "#B52C40",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  error: {
    color: "#B52C40",
    marginVertical: 8,
  },
});
