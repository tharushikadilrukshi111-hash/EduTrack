
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Common function for authenticated API requests
async function apiRequest(path, options = {}) {
  if (!API_URL) {
    throw new Error("API URL is not configured.");
  }

  const token = await SecureStore.getItemAsync("edutrack_token");

  if (!token) {
    throw new Error("Please sign in again.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (response.status === 401) {
    throw new Error("Session expired. Please sign in again.");
  }

  if (response.status === 403) {
    throw new Error("Access denied.");
  }

  if (!response.ok) {
    throw new Error(data.message || "API request failed.");
  }

  return data;
}

// Get all students or search by registration number
export async function getStudents(search = "") {
  const query = search.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";

  const data = await apiRequest(`/api/students${query}`);

  return data.students;
}

// Register a new student
export async function registerStudent(studentData) {
  return apiRequest("/api/students", {
    method: "POST",
    body: JSON.stringify(studentData),
  });
}

// Get a single student's details
export async function getStudentById(studentId) {
  const data = await apiRequest(
    `/api/students/${encodeURIComponent(studentId)}`
  );

  return data.student;
}
