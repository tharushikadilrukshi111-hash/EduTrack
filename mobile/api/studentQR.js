const pngPrefix = "data:image/png;base64,";
const base64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBytes(encoded) {
  const bytes = [];
  for (let index = 0; index < encoded.length; index += 4) {
    const bits = (base64.indexOf(encoded[index]) << 18) |
      (base64.indexOf(encoded[index + 1]) << 12) |
      (Math.max(0, base64.indexOf(encoded[index + 2])) << 6) |
      Math.max(0, base64.indexOf(encoded[index + 3]));
    bytes.push(bits >>> 16);
    if (encoded[index + 2] !== "=") bytes.push((bits >>> 8) & 255);
    if (encoded[index + 3] !== "=") bytes.push(bits & 255);
  }
  return bytes;
}

function isBoundedPng(uri) {
  if (typeof uri !== "string" || uri.length > 128 * 1024 || !uri.startsWith(pngPrefix)) return false;
  const encoded = uri.slice(pngPrefix.length);
  if (encoded.length < 64 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;

  // Check the signature, dimensions and IEND without decoding the full image in JS.
  const header = decodeBytes(encoded.slice(0, 32));
  const tail = decodeBytes(encoded.slice(-20)).slice(-12);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
  const end = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
  if (!signature.every((byte, index) => header[index] === byte) ||
      !end.every((byte, index) => tail[index] === byte)) return false;
  const dimensions = new DataView(Uint8Array.from(header).buffer);
  const width = dimensions.getUint32(16);
  return width >= 21 && width <= 512 && width === dimensions.getUint32(20);
}

const failure = (errorKey) => ({ status: "error", errorKey });
const objectId = (value) => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);

export async function fetchStudentQR({ apiUrl, accountId, readToken, signal }) {
  if (!apiUrl) return failure("auth.apiNotConfigured");
  if (!objectId(accountId)) return failure("student.qrInvalid");
  let token;
  try {
    token = await readToken();
  } catch {
    return failure("auth.sessionReadFailure");
  }
  if (signal.aborted) return { status: "cancelled" };
  if (typeof token !== "string" || !token) return failure("auth.noSavedSession");
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return failure("auth.sessionExpired");

  let response;
  try {
    response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/qr/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });
  } catch {
    return signal.aborted ? { status: "cancelled" } : failure("student.connectionError");
  }
  if (signal.aborted) return { status: "cancelled" };
  if (response.status === 401) return failure("auth.sessionExpired");
  if (response.status === 403) return failure("student.qrAccessDenied");
  if (response.status === 404) return failure("student.qrProfileNotFound");
  if (!response.ok) return failure("student.qrUnavailable");

  try {
    const data = await response.json();
    if (signal.aborted) return { status: "cancelled" };
    const { student, payload, qrImage } = data;
    if (!objectId(student?.id) || student.userId !== accountId ||
        typeof student.name !== "string" || !student.name.trim() ||
        typeof student.registrationNumber !== "string" || !student.registrationNumber.trim() ||
        typeof payload !== "string" || payload.length > 512 || !isBoundedPng(qrImage)) {
      return failure("student.qrInvalid");
    }
    const payloadPrefix = `EDUTRACK:${student.registrationNumber}:`;
    if (!payload.startsWith(payloadPrefix) || !/^[a-f0-9]{16}$/.test(payload.slice(payloadPrefix.length))) {
      return failure("student.qrInvalid");
    }

    return { status: "success", qrImage, student: {
      name: student.name, registrationNumber: student.registrationNumber,
    } };
  } catch {
    return signal.aborted ? { status: "cancelled" } : failure("student.qrInvalid");
  }
}
