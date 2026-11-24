
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { registerStudent } from "../../api/teacherStudents";

export default function AddStudentScreen({ onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);

  async function saveStudent() {
    if (!name.trim()) {
      return Alert.alert("Error", "Enter student name.");
    }

    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return Alert.alert("Error", "Enter a valid email.");
    }

    setLoading(true);

    try {
      const data = await registerStudent({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dateOfBirth: dateOfBirth.trim(),
      });

      const message =
        `Registration Number: ${data.student.registrationNumber}` +
        (data.temporaryPassword
          ? `\nTemporary Password: ${data.temporaryPassword}`
          : "");

      Alert.alert(
        "Student Registered",
        message,
        [{ text: "OK", onPress: onBack }],
        { cancelable: false }
      );
    } catch (err) {
      Alert.alert("Registration Failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.back} onPress={loading ? undefined : onBack}>
        ← Back to Students
      </Text>

      <Text style={styles.title}>Register New Student</Text>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter student name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Email (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="student@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Phone (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Date of Birth (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={saveStudent}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Register Student</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F4F7FB",
  },
  back: {
    color: "#078692",
    fontWeight: "bold",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#173B64",
    marginBottom: 20,
  },
  label: {
    color: "#173B64",
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 10,
    padding: 15,
  },
  button: {
    backgroundColor: "#078692",
    padding: 17,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 25,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
