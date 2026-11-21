export function isValidClassList(classes) {
  if (!Array.isArray(classes)) return false;
  const ids = new Set();
  for (const item of classes) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    if (typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) return false;
    if (typeof item.name !== "string" || !item.name.trim()) return false;
    for (const field of ["subject", "teacherName", "scheduleLabel"]) {
      if (item[field] != null && typeof item[field] !== "string") return false;
    }
    ids.add(item.id);
  }
  return true;
}

function mapClasses(data) {
  if (!Array.isArray(data?.classes) || data.count !== data.classes.length) return null;

  const classes = [];
  for (const item of data.classes) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const { id, name, subject, schedule } = item;
    if (schedule != null && (!Array.isArray(schedule) || schedule.some((session) =>
      !session || [session.day, session.startTime, session.endTime].some((field) =>
        typeof field !== "string" || !field.trim()
      )
    ))) return null;

    classes.push({
      id,
      name,
      subject,
      scheduleLabel: schedule?.map(({ day, startTime, endTime }) =>
        `${day} ${startTime}–${endTime}`
      ).join("\n"),
    });
  }
  return isValidClassList(classes) ? classes : null;
}

const failure = (errorKey) => ({ status: "error", errorKey });

export async function fetchStudentClasses({ apiUrl, readToken, signal }) {
  if (!apiUrl) return failure("auth.apiNotConfigured");

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
    response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/classes`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch {
    return failure("student.connectionError");
  }
  if (response.status === 401) return failure("auth.sessionExpired");
  if (response.status === 403) return failure("student.classesAccessDenied");
  if (response.status === 404) return failure("student.classesNotFound");
  if (!response.ok) return failure("student.classesRequestFailed");

  try {
    const classes = mapClasses(await response.json());
    return classes ? { status: "success", classes } : failure("student.classesInvalid");
  } catch {
    return failure("student.classesInvalid");
  }
}
