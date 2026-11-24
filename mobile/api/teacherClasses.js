
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function request(path, options = {}) {
  const token = await SecureStore.getItemAsync("edutrack_token");

  if (!API_URL || !token) {
    throw new Error("Check API configuration or sign in again.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

// Get all active classes
export async function getClasses() {
  const data = await request("/api/classes?active=true");
  return data.classes;
}

// Create a new class
export async function createClass(classData) {
  return request("/api/classes", {
    method: "POST",
    body: JSON.stringify(classData),
  });
}

// Get class details
export async function getClassById(classId) {
  return request(`/api/classes/${classId}`);
}

// Enroll a student
export async function enrollStudent(classId, registrationNumber) {
  return request(`/api/classes/${classId}/students`, {
    method: "POST",
    body: JSON.stringify({ registrationNumber }),
  });
}

// Update a class
export async function updateClass(classId, classData) {
  return request(`/api/classes/${classId}`, {
    method: "PATCH",
    body: JSON.stringify(classData),
  });
}

// Deactivate a class
export async function deleteClass(classId) {
  return request(`/api/classes/${classId}`, {
    method: "DELETE",
  });
}

// Remove a student from a class
export async function removeStudent(classId, studentId) {
  return request(`/api/classes/${classId}/students/${studentId}`, {
    method: "DELETE",
  });
}
