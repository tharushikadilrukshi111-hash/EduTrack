function formatSize(bytes) {
  if (bytes == null) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  const megabyte = 1024 * 1024;
  const unit = bytes < megabyte ? 1024 : megabyte;
  return `${Number((bytes / unit).toFixed(1))} ${unit === 1024 ? "KB" : "MB"}`;
}

function mapMaterials(data, classId) {
  if (!Array.isArray(data?.materials) || data.count !== data.materials.length) return null;

  const ids = new Set();
  const materials = [];
  for (const item of data.materials) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const { id, title, description, fileType, size, createdAt } = item;
    if (item.classId !== classId || typeof id !== "string" || !id.trim() || ids.has(id) ||
        typeof title !== "string" || !title.trim()) return null;
    if ([description, fileType, createdAt].some((value) => value != null && typeof value !== "string")) return null;
    if (size != null && (!Number.isSafeInteger(size) || size < 0)) return null;
    const created = createdAt == null ? null : new Date(createdAt);
    if (created && !Number.isFinite(created.getTime())) return null;

    ids.add(id);
    materials.push({
      id,
      title,
      description,
      fileType,
      size,
      fileSizeLabel: formatSize(size),
      addedDateLabel: created?.toISOString().slice(0, 10),
    });
  }
  return materials;
}

const failure = (errorKey) => ({ status: "error", errorKey });

export async function fetchStudentMaterials({ apiUrl, classId, readToken, signal }) {
  if (!apiUrl) return failure("auth.apiNotConfigured");
  if (typeof classId !== "string" || !classId.trim()) return failure("materials.notFound");

  let token;
  try {
    token = await readToken();
  } catch {
    return failure("auth.sessionReadFailure");
  }
  if (signal.aborted) return;
  if (typeof token !== "string" || !token.trim()) return failure("auth.noSavedSession");

  let response;
  try {
    response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/materials?classId=${encodeURIComponent(classId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch {
    return failure("materials.connectionError");
  }
  if (response.status === 401) return failure("auth.sessionExpired");
  if (response.status === 403) return failure("materials.accessDenied");
  if (response.status === 404) return failure("materials.notFound");
  if (!response.ok) return failure("materials.error");

  try {
    const materials = mapMaterials(await response.json(), classId);
    return materials ? { status: "success", materials } : failure("materials.invalidResponse");
  } catch {
    return failure("materials.invalidResponse");
  }
}
