
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";

import { getClasses } from "../../api/teacherClasses";
import {
  getMaterials,
  deleteMaterial,
} from "../../api/teacherMaterials";

export default function MaterialManagementScreen({
  onUpload,
  onBack,
}) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [materials, setMaterials] = useState([]);
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

  async function selectClass(item) {
    setSelectedClass(item);
    setMaterials([]);
    setLoading(true);
    setError("");

    try {
      const data = await getMaterials(item.id);
      setMaterials(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  function handleDelete(materialId) {
    Alert.alert(
      "Delete Material",
      "Are you sure you want to delete this material?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);

            try {
              await deleteMaterial(materialId);

              setMaterials((previous) =>
                previous.filter(
                  (item) => item.id !== materialId
                )
              );

              Alert.alert("Success", "Material deleted.");
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
    <ScrollView style={styles.container}>
      <Text style={styles.back} onPress={onBack}>
        ← Back to Dashboard
      </Text>

      <Text style={styles.title}>Material Management</Text>

      <Text style={styles.subtitle}>
        Select a class to manage learning materials.
      </Text>

      {loading && <ActivityIndicator color="#078692" />}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {!loading && classes.length === 0 && (
        <Text style={styles.subtitle}>No classes available.</Text>
      )}

      {classes.map((item) => (
        <TouchableOpacity
          key={item.id}
          disabled={loading}
          style={[
            styles.card,
            selectedClass?.id === item.id && styles.selected,
          ]}
          onPress={() => selectClass(item)}
        >
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.subtitle}>{item.subject}</Text>
        </TouchableOpacity>
      ))}

      {selectedClass && (
        <View>
          <Text style={styles.sectionTitle}>
            {selectedClass.name} – Materials
          </Text>

          <TouchableOpacity
            style={styles.button}
            disabled={loading}
            onPress={() => onUpload(selectedClass)}
          >
            <Text style={styles.buttonText}>
              + Upload New Material
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            disabled={loading}
            onPress={() => selectClass(selectedClass)}
          >
            <Text style={styles.buttonText}>Refresh</Text>
          </TouchableOpacity>

          {!loading && !error && materials.length === 0 && (
            <Text style={styles.subtitle}>
              No materials uploaded yet.
            </Text>
          )}

          {materials.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.title}</Text>

              <Text style={styles.subtitle}>
                {item.description}
              </Text>

              <Text style={styles.subtitle}>
                File: {item.originalName}
              </Text>

              <Text style={styles.subtitle}>
                Type: {item.fileType}
              </Text>

              <Text style={styles.subtitle}>
                Size: {(item.size / 1024).toFixed(1)} KB
              </Text>

              <Text style={styles.subtitle}>
                Uploaded:{" "}
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>

              <TouchableOpacity
                style={styles.deleteButton}
                disabled={loading}
                onPress={() => handleDelete(item.id)}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
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
  sectionTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#173B64",
    marginTop: 20,
  },
  subtitle: {
    color: "#718198",
    marginVertical: 5,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  selected: {
    borderColor: "#078692",
    borderWidth: 2,
    backgroundColor: "#E2F5F5",
  },
  name: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#173B64",
  },
  button: {
    backgroundColor: "#078692",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 8,
  },
  deleteButton: {
    backgroundColor: "#B52C40",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
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
