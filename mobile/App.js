import React, { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const BLUE = "#173B64";
const TEAL = "#078692";

const ROLES = {
  student: {
    title: "Student sign in",
    label: "Registration no. or email",
    hint: "ET-2026-0142",
    help: "First visit? Activate your student account",
  },
  teacher: {
    title: "Educator sign in",
    label: "Email address",
    hint: "teacher@example.com",
    help: "New educator? Create an account",
  },
  parent: {
    title: "Parent sign in",
    label: "Email address",
    hint: "parent@example.com",
    help: "Need access? Contact your educator",
  },
  admin: {
    title: "Admin sign in",
    label: "Work email",
    hint: "admin@example.com",
    help: "Administrator access is by invitation",
  },
};

function Button({ title, onPress, disabled = false, light = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        light && styles.lightButton,
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.buttonText, light && { color: BLUE }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [page, setPage] = useState("checkingSession");
  const [role, setRole] = useState("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [teacherData, setTeacherData] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const sessionCheck = useRef(0);

  useEffect(() => {
    restoreSession();
    return () => {
      sessionCheck.current += 1;
    };
  }, []);

  async function restoreSession() {
    const check = ++sessionCheck.current;
    const isCurrent = () => check === sessionCheck.current;
    setSessionError("");
    setPage("checkingSession");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const token = await SecureStore.getItemAsync("edutrack_token");
      if (!isCurrent()) return;
      if (!token) {
        setUser(null);
        setPage("welcome");
        return;
      }
      if (!API_URL) throw new Error("Missing API URL");

      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!isCurrent()) return;

      if (response.status === 401) {
        await SecureStore.deleteItemAsync("edutrack_token");
        if (!isCurrent()) return;
        setUser(null);
        setPage("welcome");
        return;
      }
      if (!response.ok) throw new Error("Session verification failed");

      const data = await response.json();
      if (!isCurrent()) return;
      if (
        !data.user ||
        !["student", "teacher"].includes(data.user.role) ||
        typeof data.user.id !== "string" || !data.user.id ||
        typeof data.user.name !== "string" ||
        typeof data.user.identifier !== "string"
      ) {
        throw new Error("Unexpected account response");
      }

      setUser(data.user);
      setRole(data.user.role);
      setPage("dashboard");
    } catch {
      if (isCurrent()) {
        setUser(null);
        setSessionError("Could not verify your saved session. Check your connection and backend, then retry.");
        setPage("sessionError");
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  function chooseRole(nextRole) {
    setTeacherData(null);
    setTeacherError("");
    setTeacherLoading(false);
    setRole(nextRole);
    setIdentifier("");
    setPassword("");
    setError("");
    setVisible(false);
    setPage("login");
  }

  async function signIn() {
    sessionCheck.current += 1;
    setError("");
    const id = identifier.trim();

    if (!id || !password) {
      return setError("Please enter your login details and password.");
    }

    if (
      (role !== "student" || id.includes("@")) &&
      !/^\S+@\S+\.\S+$/.test(id)
    ) {
      return setError("Please enter a valid email address.");
    }

    if (password.length < 8) {
      return setError("Password must have at least 8 characters.");
    }

    if (role === "parent" || role === "admin") {
      return setError(
        "This login screen is ready. Backend access for this role is not added yet.",
      );
    }

    if (!API_URL) {
      return setError("Set EXPO_PUBLIC_API_URL in mobile/.env first.");
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          identifier: id,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.token || !data.user) {
        setError(data.message || "Sign in failed.");
      } else if (data.user.role !== role) {
        setError("This account cannot access the selected role.");
      } else {
        await SecureStore.setItemAsync("edutrack_token", data.token);
        setUser(data.user);
        setPassword("");
        setPage("dashboard");
      }
    } catch {
      setError("Cannot reach the backend. Check Wi-Fi, IP address and server.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTeacherData() {
    if (role !== "teacher" || user?.role !== "teacher" || teacherLoading) {
      return;
    }

    const check = sessionCheck.current;
    const isCurrent = () => check === sessionCheck.current;
    setTeacherData(null);
    setTeacherError("");
    setTeacherLoading(true);

    try {
      if (!API_URL) {
        setTeacherError("Set EXPO_PUBLIC_API_URL in mobile/.env first.");
        return;
      }

      let token;
      try {
        token = await SecureStore.getItemAsync("edutrack_token");
      } catch {
        if (isCurrent()) {
          setTeacherError("Could not read your saved session. Please try again.");
        }
        return;
      }
      if (!isCurrent()) return;

      if (!token) {
        setTeacherError("No saved session found. Please log out and sign in again.");
        return;
      }

      const response = await fetch(`${API_URL}/api/teacher/dashboard`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!isCurrent()) return;

      if (response.status === 401) {
        try {
          await SecureStore.deleteItemAsync("edutrack_token");
        } catch {
          if (isCurrent()) {
            setTeacherError("Your session expired, but the saved token could not be removed securely. Please retry or log out.");
          }
          return;
        }
        if (!isCurrent()) return;
        setUser(null);
        setPassword("");
        setTeacherData(null);
        setPage("welcome");
        Alert.alert("Session expired", "Your session is no longer authorized. Please sign in again.");
        return;
      }
      if (response.status === 403) {
        setTeacherError("Access denied. A Teacher account is required.");
        return;
      }

      const data = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) {
        setTeacherError(data.message || "Could not load Teacher data.");
      } else if (!data.user || data.user.role !== "teacher" || data.user.id !== user.id) {
        setTeacherError("The backend returned unexpected Teacher data.");
      } else {
        setTeacherData(data.user);
      }
    } catch {
      if (isCurrent()) {
        setTeacherError("Could not load Teacher data. Check your connection and backend, then try again.");
      }
    } finally {
      if (isCurrent()) setTeacherLoading(false);
    }
  }

  const info = ROLES[role];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {page === "checkingSession" && (
            <View>
              <ActivityIndicator color={TEAL} />
              <Text style={styles.muted}>Checking your saved session...</Text>
            </View>
          )}

          {page === "sessionError" && (
            <View>
              <Text style={styles.errorText}>{sessionError}</Text>
              <Button title="Retry session check" onPress={restoreSession} />
              <Button
                title="Continue to Welcome"
                onPress={() => {
                  sessionCheck.current += 1;
                  setPage("welcome");
                }}
              />
            </View>
          )}

          {page === "welcome" && (
            <View>
              <Text style={styles.tag}>EDUTRACK · LEARN. PRACTISE. GROW.</Text>

              <Text style={styles.title}>Learn with confidence</Text>

              <View style={styles.art}>
                <Text style={{ fontSize: 92 }}>📖</Text>
                <Text style={styles.artCheck}>✓</Text>
              </View>

              <Text style={styles.bigTitle}>
                A little practice.{"\n"}A clearer path ahead.
              </Text>

              <Text style={styles.muted}>
                Quizzes, class notes and meaningful progress — together in
                EduTrack.
              </Text>

              <Button title="Get started" onPress={() => setPage("roles")} />

              <Text style={styles.small}>
                Built for students, educators and families.
              </Text>
            </View>
          )}

          {page === "roles" && (
            <View>
              <Text style={styles.back} onPress={() => setPage("welcome")}>
                ‹ WELCOME
              </Text>

              <Text style={styles.title}>Your learning space</Text>
              <Text style={styles.muted}>Choose how you use EduTrack.</Text>

              <View style={styles.studentCard}>
                <Text style={styles.whiteSmall}>FOR LEARNERS</Text>

                <Text style={styles.studentTitle}>
                  Make progress, every day.
                </Text>

                <Text style={styles.whiteSmall}>
                  Take quizzes, revisit feedback and build confidence.
                </Text>

                <Button
                  title="I'm a student"
                  light
                  onPress={() => chooseRole("student")}
                />
              </View>

              <TouchableOpacity
                style={styles.roleCard}
                onPress={() => chooseRole("teacher")}
              >
                <Text style={styles.cardTitle}>Teacher / Lecturer</Text>
                <Text style={styles.muted}>
                  Teach, assess and support your classes.
                </Text>
                <Text style={styles.link}>Continue as educator ›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.roleCard}
                onPress={() => chooseRole("parent")}
              >
                <Text style={styles.cardTitle}>Parent / Guardian</Text>
                <Text style={styles.muted}>
                  Follow your linked child's learning.
                </Text>
                <Text style={styles.link}>Continue as parent ›</Text>
              </TouchableOpacity>

              <Text style={styles.link} onPress={() => chooseRole("admin")}>
                Administrator access
              </Text>
            </View>
          )}

          {page === "login" && (
            <View>
              <Text
                style={styles.back}
                onPress={() => {
                  setError("");
                  setPage("roles");
                }}
              >
                ‹ SECURE ACCESS
              </Text>

              <Text style={styles.title}>{info.title}</Text>
              <Text style={styles.link}>{role.toUpperCase()}</Text>

              <Text style={styles.muted}>
                Welcome back. Continue where you left off.
              </Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Sign-in unsuccessful</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>{info.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={info.hint}
                value={identifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={role === "student" ? "default" : "email-address"}
                onChangeText={setIdentifier}
              />

              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!visible}
                autoCapitalize="none"
              />

              <Text style={styles.small}>At least 8 characters</Text>

              <Text style={styles.link} onPress={() => setVisible(!visible)}>
                {visible ? "Hide password" : "Show password"}
              </Text>

              <Text
                style={styles.link}
                onPress={() =>
                  Alert.alert(
                    "Coming soon",
                    "Password recovery needs a backend endpoint.",
                  )
                }
              >
                Forgot password?
              </Text>

              <View style={{ marginTop: 14 }}>
                {loading ? (
                  <ActivityIndicator color={TEAL} />
                ) : (
                  <Button title="Sign in" onPress={signIn} />
                )}
              </View>

              <Text
                style={styles.link}
                onPress={() =>
                  Alert.alert(
                    "Coming soon",
                    "Account activation/registration will be implemented next.",
                  )
                }
              >
                {info.help}
              </Text>
            </View>
          )}

          {page === "dashboard" && user && user.role === role && (
            <View>
              <Text style={styles.tag}>EDUTRACK</Text>

              <Text style={styles.bigTitle}>
                {user?.role === "teacher"
                  ? "Teacher dashboard"
                  : "Student dashboard"}
              </Text>

              <Text style={styles.muted}>
                Welcome, {user?.name || "EduTrack user"}!
              </Text>

              <View style={styles.roleCard}>
                <Text style={styles.cardTitle}>✓ Login successful</Text>
                <Text style={styles.muted}>
                  Your full dashboard will be built next.
                </Text>
              </View>

              {role === "teacher" && user.role === "teacher" && (
                <View style={styles.roleCard}>
                  <Button
                    title="Load Teacher Data"
                    onPress={loadTeacherData}
                    disabled={teacherLoading}
                  />
                  {teacherLoading && <ActivityIndicator color={TEAL} />}
                  {!!teacherError && (
                    <Text style={styles.errorText}>{teacherError}</Text>
                  )}
                  {teacherData && teacherData.id === user.id && (
                    <View>
                      <Text style={styles.cardTitle}>{teacherData.name}</Text>
                      <Text style={styles.muted}>Role: {teacherData.role}</Text>
                      <Text style={styles.muted}>Identifier: {teacherData.identifier}</Text>
                    </View>
                  )}
                </View>
              )}

              <Button
                title="Log out"
                onPress={async () => {
                  sessionCheck.current += 1;
                  setTeacherLoading(false);
                  try {
                    await SecureStore.deleteItemAsync("edutrack_token");
                    setUser(null);
                    setPassword("");
                    setPage("welcome");
                  } catch {
                    Alert.alert(
                      "Logout failed",
                      "Could not securely remove your saved session. Please try again.",
                    );
                  }
                }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 40,
    maxWidth: 460,
    width: "100%",
    alignSelf: "center",
  },
  tag: {
    color: TEAL,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10,
  },
  title: {
    color: BLUE,
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 12,
  },
  bigTitle: {
    color: BLUE,
    fontSize: 27,
    fontWeight: "800",
    marginBottom: 12,
  },
  muted: {
    color: "#718198",
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 18,
  },
  small: {
    color: "#718198",
    fontSize: 11,
    marginTop: 8,
    marginBottom: 9,
  },
  art: {
    backgroundColor: BLUE,
    borderRadius: 20,
    height: 215,
    marginVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  artCheck: {
    position: "absolute",
    bottom: 33,
    right: 65,
    color: "#FFFFFF",
    backgroundColor: "#25B8A7",
    overflow: "hidden",
    borderRadius: 20,
    fontSize: 25,
    paddingHorizontal: 9,
  },
  button: {
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 9,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  lightButton: {
    backgroundColor: "#DFF6F8",
  },
  back: {
    color: TEAL,
    fontWeight: "700",
    marginBottom: 18,
    marginTop: 8,
  },
  studentCard: {
    backgroundColor: BLUE,
    borderRadius: 18,
    padding: 20,
    marginBottom: 15,
  },
  studentTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
    marginVertical: 11,
  },
  whiteSmall: {
    color: "#E0F1FA",
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 8,
  },
  roleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DEE7EF",
    padding: 17,
    marginBottom: 13,
  },
  cardTitle: {
    color: BLUE,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  link: {
    color: TEAL,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  fieldLabel: {
    color: BLUE,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEE7EF",
    paddingHorizontal: 13,
    borderRadius: 10,
    height: 49,
  },
  errorBox: {
    backgroundColor: "#FFF0F1",
    borderRadius: 10,
    padding: 13,
    marginVertical: 13,
  },
  errorTitle: {
    color: "#B52C40",
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: "#B52C40",
    fontSize: 12,
    marginTop: 5,
  },
});
