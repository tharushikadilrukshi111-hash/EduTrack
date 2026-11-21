
const validId = (value) =>
  typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

const activeDownloads = new Set();

export function isPdfMaterial(material) {
  return validId(material?.id) && typeof material.fileType === "string" &&
    material.fileType.toLowerCase() === "pdf";
}

function getStoredFile(studentId, classId, materialId) {
  const fs = require("expo-file-system");
  const directory = new fs.Directory(
    fs.Paths.document,
    "edutrack-pdfs",
    studentId,
    classId,
  );
  const file = new fs.File(directory, `${materialId}.pdf`);

  return { fs, directory, file };
}

function isValidPdf(file, fs, expectedSize) {
  if (!file.exists) return false;
  const size = file.size;
  if (size == null || size < 12 || (expectedSize != null && size !== expectedSize)) return false;

  const handle = file.open(fs.FileMode.ReadOnly);
  try {
    const header = String.fromCharCode(...handle.readBytesSync(8));
    if (!/^%PDF-\d\.\d/.test(header)) return false;
    const tailSize = Math.min(size, 1024);
    handle.offset = size - tailSize;
    const tail = String.fromCharCode(...handle.readBytesSync(tailSize));
    return /%%EOF[\x00\t\n\f\r ]*$/.test(tail);
  } finally {
    handle.close();
  }
}

export function getDownloadedPdfIds(studentId, classId, materials) {
  if (!validId(studentId) || !validId(classId) ||
      !Array.isArray(materials)) {
    return [];
  }

  return materials
    .filter(isPdfMaterial)
    .filter((material) => {
      try {
        const { fs, file } = getStoredFile(
          studentId, classId, material.id
        );
        return !activeDownloads.has(file.uri) && isValidPdf(file, fs, material.size);
      } catch {
        return false;
      }
    })
    .map((material) => material.id);
}

export async function downloadStudentPdf({
  apiUrl,
  studentId,
  classId,
  material,
  readToken,
  signal,
}) {
  if (
    !apiUrl ||
    !validId(studentId) ||
    !validId(classId) ||
    !isPdfMaterial(material)
  ) {
    throw new Error("Invalid PDF download request");
  }

  const { fs, directory, file } = getStoredFile(
    studentId, classId, material.id
  );

  const key = file.uri;
  if (activeDownloads.has(key)) throw new Error("Download already in progress");
  const temporary = new fs.File(directory, `${material.id}.part`);
  const temporaryUri = temporary.uri;
  const checkCancellation = () => {
    if (signal?.aborted) throw new Error("Download cancelled");
  };

  activeDownloads.add(key);
  try {
    checkCancellation();
    const token = await readToken();
    checkCancellation();
    if (typeof token !== "string" || !token.trim() || /\s/.test(token)) {
      throw new Error("Student session unavailable");
    }
    if (isValidPdf(file, fs, material.size)) return;
    await directory.create({ intermediates: true, idempotent: true });
    checkCancellation();
    const downloaded = await fs.File.downloadFileAsync(
      `${apiUrl.replace(/\/+$/, "")}/api/materials/${material.id}/download`,
      temporary,
      {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
        signal,
      }
    );

    checkCancellation();
    if (!isValidPdf(downloaded, fs, material.size)) {
      throw new Error("Invalid PDF received from server");
    }

    if (file.exists) await file.delete();
    checkCancellation();
    try {
      await downloaded.move(file);
      checkCancellation();
    } catch (error) {
      if (file.exists) await file.delete();
      throw error;
    }
  } finally {
    try {
      const incomplete = new fs.File(temporaryUri);
      if (incomplete.exists) await incomplete.delete();
    } finally {
      activeDownloads.delete(key);
    }
  }
}

export async function viewSavedPdf({
  studentId,
  classId,
  material,
}) {
  if (!validId(studentId) || !validId(classId) || !isPdfMaterial(material)) {
    throw new Error("Invalid PDF preview request");
  }
  const { fs, file } = getStoredFile(
    studentId, classId, material.id
  );

  if (activeDownloads.has(file.uri) || !isValidPdf(file, fs, material.size)) {
    throw new Error("PDF is not saved on this device");
  }

  await file.preview({
    mimeType: "application/pdf",
    title: material.title,
  });
}
