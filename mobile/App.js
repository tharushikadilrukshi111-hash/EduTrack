import React, { useState } from "react";
import {
  ActivityIndicator,
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
const COLORS = {
  navy: "#15375E",
  teal: "#087F8C",
  background: "#F4F7FB",
  white: "#FFFFFF",
  muted: "#657992",
  border: "#D8E4EF",
  error: "#BA3543",
  errorBg: "#FFF0F1",
  success: "#16825B",
};

export default function App() {
  const [role, setRole] = useState("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);

  function changeRole(nextRole) {
    setRole(nextRole);
    setIdentifier("");
    setPassword("");
    setError("");
  }

  async function login() {
    setError("");
    if (!identifier.trim()) {
      setError(
        role === "student"
          ? "Registration number is required."
          : "Email address is required.",
      );
      return;
    }
    if (role === "teacher" && !/^\S+@\S+\.\S+$/.test(identifier.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (!API_URL) {
      setError("API address is not configured. Check mobile/.env.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to sign in. Please try again.");
        return;
      }
      // Token is kept only in memory for this first evaluation milestone.
      setSession({ user: data.user, token: data.token });
    } catch (_error) {
      setError(
        "Cannot connect to the server. Check Wi-Fi, PC IP and backend status.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (session) {
    const isTeacher = session.user.role === "teacher";
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />
        <View style={styles.homeContainer}>
          <Text style={styles.wordmark}>EDUTRACK</Text>
          <Text style={styles.title}>
            {isTeacher ? "Teacher dashboard" : "Student dashboard"}
          </Text>
          <Text style={styles.subtitle}>Welcome, {session.user.name}!</Text>
          <View style={styles.card}>
            <Text style={styles.badge}>✓ Login successful</Text>
            <Text style={styles.cardTitle}>
              {isTeacher
                ? "Manage your tuition classes"
                : "Your learning journey starts here"}
            </Text>
            <Text style={styles.cardText}>
              {isTeacher
                ? "Student registration, quizzes and class reports are the next modules."
                : "Your enrolled classes, quizzes and progress will appear here."}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setSession(null);
              setPassword("");
            }}
          >
            <Text style={styles.buttonText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.wordmark}>EDUTRACK</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue your learning journey
          </Text>

          <View style={styles.roleSwitch}>
            {["student", "teacher"].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.roleTab,
                  role === option && styles.activeRoleTab,
                ]}
                onPress={() => changeRole(option)}
              >
                <Text
                  style={[
                    styles.roleText,
                    role === option && styles.activeRoleText,
                  ]}
                >
                  {option === "teacher" ? "Teacher" : "Student"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {role === "student" ? "Student sign in" : "Teacher sign in"}
            </Text>
            <Text style={styles.cardText}>
              Enter your registered account details
            </Text>

            <Text style={styles.label}>
              {role === "student" ? "Registration number" : "Email address"}
            </Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={
                role === "student" ? "e.g. STU-1001" : "name@example.com"
              }
              placeholderTextColor={COLORS.muted}
              keyboardType={role === "teacher" ? "email-address" : "default"}
              autoCapitalize={role === "teacher" ? "none" : "characters"}
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor={COLORS.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel="Toggle password visibility"
              >
                <Text style={styles.showText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.disabled]}
              onPress={login}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Log in as {role}</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Your account must be registered by an authorized user.
            </Text>
          </View>
          <Text style={styles.footer}>EduTrack • Learn • Quiz • Grow</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 34,
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.teal,
    letterSpacing: 2,
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.navy,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.muted,
    marginBottom: 28,
  },
  roleSwitch: {
    backgroundColor: "#E7EEF5",
    borderRadius: 15,
    flexDirection: "row",
    padding: 5,
    marginBottom: 22,
  },
  roleTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 11,
  },
  activeRoleTab: { backgroundColor: COLORS.navy },
  roleText: { fontSize: 15, fontWeight: "700", color: COLORS.navy },
  activeRoleText: { color: COLORS.white },
  card: {
    padding: 22,
    backgroundColor: COLORS.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E6EDF5",
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: COLORS.navy,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 24,
    lineHeight: 19,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 8,
  },
  input: {
    height: 53,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 19,
    fontSize: 15,
    color: COLORS.navy,
  },
  passwordContainer: {
    height: 53,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  passwordInput: { flex: 1, fontSize: 15, color: COLORS.navy },
  showText: { color: COLORS.teal, fontWeight: "700", padding: 8 },
  errorBox: {
    backgroundColor: COLORS.errorBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: COLORS.error, fontSize: 13, lineHeight: 19 },
  button: {
    height: 52,
    borderRadius: 13,
    backgroundColor: COLORS.teal,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  hint: {
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
  },
  footer: {
    textAlign: "center",
    marginTop: 30,
    color: COLORS.muted,
    fontSize: 12,
  },
  homeContainer: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  badge: { color: COLORS.success, fontWeight: "800", marginBottom: 14 },
});
