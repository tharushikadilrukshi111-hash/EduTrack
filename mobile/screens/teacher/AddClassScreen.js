
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";

export default function AddClassScreen({ onBack }) {
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  function handleSave() {
    if (!className.trim() || !subject.trim() || !grade.trim()) {
      Alert.alert(
        "Missing Information",
        "Please fill in all fields."
      );
      return;
    }

    Alert.alert(
      "Form Validated",
      "Class details are ready to send to the backend."
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← Back to Classes</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Create New Class</Text>

      <Text style={styles.subtitle}>
        Enter the details of your new class.
      </Text>

      <Text style={styles.label}>Class Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Grade 10 Mathematics"
        value={className}
        onChangeText={setClassName}
      />

      <Text style={styles.label}>Subject</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Mathematics"
        value={subject}
        onChangeText={setSubject}
      />

      <Text style={styles.label}>Grade</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Grade 10"
        value={grade}
        onChangeText={setGrade}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSave}
      >
        <Text style={styles.buttonText}>Save Class</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    fontSize: 14,
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
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
