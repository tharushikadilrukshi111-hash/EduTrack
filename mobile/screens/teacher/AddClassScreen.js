
import React, { useState } from "react";
import {
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { createClass } from "../../api/teacherClasses";

export default function AddClassScreen({ onBack }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState("");
  const [loading, setLoading] = useState(false);

  async function saveClass() {
    if (!name.trim() || !subject.trim() || !fee.trim()) {
      return Alert.alert("Error", "Fill all required fields.");
    }

    if (!Number.isFinite(Number(fee)) || Number(fee) < 0) {
      return Alert.alert("Error", "Enter a valid fee.");
    }

    setLoading(true);

    try {
      await createClass({
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim(),
        fee: Number(fee),
        schedule: [],
      });

      Alert.alert(
        "Success",
        "Class created successfully.",
        [{ text: "OK", onPress: onBack }],
        { cancelable: false }
      );
    } catch (err) {
      Alert.alert("Error", err.message);
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
        ← Back to Classes
      </Text>

      <Text style={styles.title}>Create New Class</Text>

      <Text style={styles.label}>Class Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Grade 10 Mathematics"
        value={name}
        onChangeText={setName}
        maxLength={100}
      />

      <Text style={styles.label}>Subject *</Text>
      <TextInput
        style={styles.input}
        placeholder="Mathematics"
        value={subject}
        onChangeText={setSubject}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 90 }]}
        placeholder="Enter class description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
      />

      <Text style={styles.label}>Class Fee (Rs.) *</Text>
      <TextInput
        style={styles.input}
        placeholder="1500"
        value={fee}
        onChangeText={setFee}
        keyboardType="decimal-pad"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={saveClass}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Save Class</Text>
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
    marginBottom: 15,
  },
  label: {
    fontWeight: "bold",
    color: "#173B64",
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
