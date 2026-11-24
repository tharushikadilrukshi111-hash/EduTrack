
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

async function getToken() {
  const token = await SecureStore.getItemAsync("edutrack_token");

  if (!API_URL || !token) {
    throw new Error("Check API configuration or sign in again.");
  }

  return token;
}

async function request(path, options = {}) {
  const token = await getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

// Get materials
export async function getMaterials(classId) {
  const data = await request(
    `/api/materials?classId=${encodeURIComponent(classId)}`
  );

  return data.materials;
}

// Upload material
export async function uploadMaterial({
  classId,
  title,
  description,
  file,
}) {
  const token = await getToken();

  const response = await FileSystem.uploadAsync(
    `${API_URL}/api/materials`,
    file.uri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: file.mimeType || "application/octet-stream",

      headers: {
        Authorization: `Bearer ${token}`,
      },

      parameters: {
        classId: String(classId),
        title: title,
        description: description || "",
      },
    }
  );

  let data;

  try {
    data = JSON.parse(response.body);
  } catch {
    throw new Error(`Server returned status ${response.status}`);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(data.message || "Upload failed.");
  }

  return data;
}

// Delete material
export async function deleteMaterial(materialId) {
  return request(`/api/materials/${materialId}`, {
    method: "DELETE",
  });
}
