
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

import * as DocumentPicker from "expo-document-picker";
import { uploadMaterial } from "../../api/teacherMaterials";
import * as FileSystem from "expo-file-system/legacy";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
];

export default function UploadMaterialScreen({
  selectedClass,
  onBack,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  
async function pickFile() {
  setPicking(true);
  setFile(null);

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_TYPES,
      copyToCacheDirectory: false,
      multiple: false,
    });

    if (result.canceled) return;

    const selectedFile = result.assets[0];

    if (!ALLOWED_TYPES.includes(selectedFile.mimeType)) {
      throw new Error("Unsupported file type.");
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      throw new Error("Maximum file size is 10 MB.");
    }

    if (!FileSystem.cacheDirectory) {
      throw new Error("Cache directory unavailable.");
    }

    const directory =
      FileSystem.cacheDirectory + "materials/";

    await FileSystem.makeDirectoryAsync(directory, {
      intermediates: true,
    });

    const safeName = selectedFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const localUri =
      directory + Date.now() + "-" + safeName;

    console.log("Source URI:", selectedFile.uri);
    console.log("Destination URI:", localUri);

    await FileSystem.copyAsync({
      from: selectedFile.uri,
      to: localUri,
    });

    const info = await FileSystem.getInfoAsync(localUri);

    if (!info.exists || info.isDirectory) {
      throw new Error("File was not copied successfully.");
    }

    if (info.size > 10 * 1024 * 1024) {
      await FileSystem.deleteAsync(localUri, {
        idempotent: true,
      });

      throw new Error("Maximum file size is 10 MB.");
    }

    console.log("Cached file info:", info);

    setFile({
      ...selectedFile,
      uri: localUri,
      size: info.size,
    });

  } catch (err) {
    console.log("File preparation error:", err.message);
    Alert.alert("File Selection Failed", err.message);
  } finally {
    setPicking(false);
  }
}



  async function handleUpload() {
    if (!selectedClass?.id) {
      return Alert.alert("Error", "Select a class.");
    }

    if (!title.trim()) {
      return Alert.alert("Error", "Enter material title.");
    }

    if (!file) {
      return Alert.alert("Error", "Select a file.");
    }

    setLoading(true);

    try {
      await uploadMaterial({
        classId: selectedClass.id,
        title: title.trim(),
        description: description.trim(),
        file,
      });

      Alert.alert(
        "Success",
        "Material uploaded successfully.",
        [{ text: "OK", onPress: onBack }],
        { cancelable: false }
      );

    } catch (err) {
      console.log("Material upload error:", err.message);
      Alert.alert("Upload Failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={styles.back}
        onPress={loading || picking ? undefined : onBack}
      >
        ← Back to Materials
      </Text>

      <Text style={styles.title}>
        Upload Learning Material
      </Text>

      <Text style={styles.subtitle}>
        Class: {selectedClass?.name}
      </Text>

      <Text style={styles.label}>Material Title *</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter material title"
        value={title}
        onChangeText={setTitle}
        editable={!loading}
        maxLength={150}
      />

      <Text style={styles.label}>Description</Text>

      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Enter description"
        value={description}
        onChangeText={setDescription}
        multiline
        editable={!loading}
        maxLength={500}
      />

      <Text style={styles.label}>Select File *</Text>

      <TouchableOpacity
        style={styles.fileButton}
        onPress={pickFile}
        disabled={loading || picking}
      >
        <Text style={styles.fileText}>
          {picking
            ? "Preparing file..."
            : file
              ? file.name
              : "Choose File"}
        </Text>
      </TouchableOpacity>

      {file && (
        <Text style={styles.subtitle}>
          Size: {((file.size || 0) / 1024).toFixed(1)} KB
        </Text>
      )}

      <Text style={styles.subtitle}>
        PDF, Word, PowerPoint, TXT, JPG and PNG.
        Maximum size: 10 MB.
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          (loading || picking) && { opacity: 0.6 },
        ]}
        onPress={handleUpload}
        disabled={loading || picking}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Upload Material
          </Text>
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
    marginBottom: 10,
  },
  subtitle: {
    color: "#718198",
    marginVertical: 8,
  },
  label: {
    color: "#173B64",
    fontWeight: "bold",
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 10,
    padding: 15,
  },
  fileButton: {
    backgroundColor: "#E2F5F5",
    borderWidth: 1,
    borderColor: "#078692",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  fileText: {
    color: "#078692",
    fontWeight: "bold",
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
