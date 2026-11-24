
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";

export default function AddStudentScreen({ onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function handleSave() {
    if (!name.trim() || !email.trim()) {
      Alert.alert(
        "Missing Information",
        "Please enter the student's name and email."
      );
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert("Invalid Email", "Enter a valid email address.");
      return;
    }

    Alert.alert(
      "Form Validated",
      "Student details are ready to send to the backend."
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← Back to Students</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Add New Student</Text>

      <Text style={styles.subtitle}>
        Enter student information below.
      </Text>

      <Text style={styles.label}>Student Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter full name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="student@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Phone Number (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSave}
      >
        <Text style={styles.buttonText}>Save Student</Text>
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
    fontWeight: "700",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#173B64",
  },
  subtitle: {
    color: "#718198",
    marginTop: 8,
    marginBottom: 20,
  },
  label: {
    color: "#173B64",
    fontWeight: "700",
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 10,
    padding: 14,
  },
  button: {
    backgroundColor: "#078692",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
    marginBottom: 30,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
