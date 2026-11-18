import React, { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import LanguageSwitcher from "./components/LanguageSwitcher";
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
    title: "login.studentTitle",
    label: "login.registrationOrEmail",
    hint: "ET-2026-0142",
    help: "login.studentHelp",
  },
  teacher: {
    title: "login.teacherTitle",
    label: "login.email",
    hint: "teacher@example.com",
    help: "login.teacherHelp",
  },
  parent: {
    title: "login.parentTitle",
    label: "login.email",
    hint: "parent@example.com",
    help: "login.parentHelp",
  },
  admin: {
    title: "login.adminTitle",
    label: "login.workEmail",
    hint: "admin@example.com",
    help: "login.adminHelp",
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
  return <LanguageProvider><AppContent /></LanguageProvider>;
}

function AppContent() {
  const { t } = useLanguage();
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
        setSessionError("auth.sessionVerificationFailure");
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
      return setError({ key: "auth.requiredFields" });
    }

    if (
      (role !== "student" || id.includes("@")) &&
      !/^\S+@\S+\.\S+$/.test(id)
    ) {
      return setError({ key: "auth.invalidEmail" });
    }

    if (password.length < 8) {
      return setError({ key: "auth.shortPassword" });
    }

    if (role === "parent" || role === "admin") {
      return setError({ key: "auth.roleUnavailable" });
    }

    if (!API_URL) {
      return setError({ key: "auth.apiNotConfigured" });
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
        setError(typeof data.message === "string" && data.message
          ? { message: data.message }
          : { key: "auth.signInFailure" });
      } else if (data.user.role !== role) {
        setError({ key: "auth.roleMismatch" });
      } else {
        await SecureStore.setItemAsync("edutrack_token", data.token);
        setUser(data.user);
        setPassword("");
        setPage("dashboard");
      }
    } catch {
      setError({ key: "auth.connectionFailure" });
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
        setTeacherError({ key: "auth.apiNotConfigured" });
        return;
      }

      let token;
      try {
        token = await SecureStore.getItemAsync("edutrack_token");
      } catch {
        if (isCurrent()) {
          setTeacherError({ key: "auth.sessionReadFailure" });
        }
        return;
      }
      if (!isCurrent()) return;

      if (!token) {
        setTeacherError({ key: "auth.noSavedSession" });
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
            setTeacherError({ key: "auth.expiredTokenRemovalFailure" });
          }
          return;
        }
        if (!isCurrent()) return;
        setUser(null);
        setPassword("");
        setTeacherData(null);
        setPage("welcome");
        Alert.alert(t("auth.sessionExpiredTitle"), t("auth.sessionExpired"));
        return;
      }
      if (response.status === 403) {
        setTeacherError({ key: "auth.teacherAccessDenied" });
        return;
      }

      const data = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) {
        setTeacherError(typeof data.message === "string" && data.message
          ? { message: data.message }
          : { key: "auth.teacherDataFailure" });
      } else if (!data.user || data.user.role !== "teacher" || data.user.id !== user.id) {
        setTeacherError({ key: "auth.unexpectedTeacherData" });
      } else {
        setTeacherData(data.user);
      }
    } catch {
      if (isCurrent()) {
        setTeacherError({ key: "auth.teacherConnectionFailure" });
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
              <Text style={styles.muted}>{t("auth.checkingSession")}</Text>
            </View>
          )}

          {page === "sessionError" && (
            <View>
              <LanguageSwitcher />
              <Text style={styles.errorText}>{sessionError ? t(sessionError) : ""}</Text>
              <Button title={t("auth.retrySession")} onPress={restoreSession} />
              <Button
                title={t("auth.continueToWelcome")}
                onPress={() => {
                  sessionCheck.current += 1;
                  setPage("welcome");
                }}
              />
            </View>
          )}

          {page === "welcome" && (
            <View>
              <LanguageSwitcher />
              <Text style={styles.tag}>{t("welcome.tagline")}</Text>

              <Text style={styles.title}>{t("welcome.heading")}</Text>

              <View style={styles.art}>
                <Text style={{ fontSize: 92 }}>📖</Text>
                <Text style={styles.artCheck}>✓</Text>
              </View>

              <Text style={styles.bigTitle}>
                {t("welcome.description")}
              </Text>

              <Text style={styles.muted}>
                {t("welcome.supportingText")}
              </Text>

              <Button title={t("welcome.getStarted")} onPress={() => setPage("roles")} />

              <Text style={styles.small}>
                {t("welcome.audience")}
              </Text>
            </View>
          )}

          {page === "roles" && (
            <View>
              <Text style={styles.back} onPress={() => setPage("welcome")}>
                ‹ {t("welcome.back")}
              </Text>

              <Text style={styles.title}>{t("roles.heading")}</Text>
              <Text style={styles.muted}>{t("roles.description")}</Text>

              <View style={styles.studentCard}>
                <Text style={styles.whiteSmall}>{t("roles.forLearners")}</Text>

                <Text style={styles.studentTitle}>
                  {t("roles.progress")}
                </Text>

                <Text style={styles.whiteSmall}>
                  {t("roles.studentDescription")}
                </Text>

                <Button
                  title={t("roles.chooseStudent")}
                  light
                  onPress={() => chooseRole("student")}
                />
              </View>

              <TouchableOpacity
                style={styles.roleCard}
                onPress={() => chooseRole("teacher")}
              >
                <Text style={styles.cardTitle}>{t("roles.teacher")}</Text>
                <Text style={styles.muted}>
                  {t("roles.teacherDescription")}
                </Text>
                <Text style={styles.link}>{t("roles.continueTeacher")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.roleCard}
                onPress={() => chooseRole("parent")}
              >
                <Text style={styles.cardTitle}>{t("roles.parent")}</Text>
                <Text style={styles.muted}>
                  {t("roles.parentDescription")}
                </Text>
                <Text style={styles.link}>{t("roles.continueParent")}</Text>
              </TouchableOpacity>

              <Text style={styles.link} onPress={() => chooseRole("admin")}>
                {t("roles.adminAccess")}
              </Text>
            </View>
          )}

          {page === "login" && (
            <View>
              <LanguageSwitcher />
              <Text
                style={styles.back}
                onPress={() => {
                  setError("");
                  setPage("roles");
                }}
              >
                ‹ {t("login.secureAccess")}
              </Text>

              <Text style={styles.title}>{t(info.title)}</Text>
              <Text style={styles.link}>{t(`roles.${role}`)}</Text>

              <Text style={styles.muted}>
                {t("login.welcomeBack")}
              </Text>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>{t("login.unsuccessful")}</Text>
                  <Text style={styles.errorText}>{error.key ? t(error.key) : error.message}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>{t(info.label)}</Text>
              <TextInput
                style={styles.input}
                placeholder={info.hint}
                value={identifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={role === "student" ? "default" : "email-address"}
                onChangeText={setIdentifier}
              />

              <Text style={styles.fieldLabel}>{t("login.password")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("login.passwordPlaceholder")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!visible}
                autoCapitalize="none"
              />

              <Text style={styles.small}>{t("login.passwordHint")}</Text>

              <Text style={styles.link} onPress={() => setVisible(!visible)}>
                {t(visible ? "login.hidePassword" : "login.showPassword")}
              </Text>

              <Text
                style={styles.link}
                onPress={() =>
                  Alert.alert(
                    t("login.comingSoon"),
                    t("login.passwordRecoveryUnavailable"),
                  )
                }
              >
                {t("login.forgotPassword")}
              </Text>

              <View style={{ marginTop: 14 }}>
                {loading ? (
                  <View accessibilityLiveRegion="polite">
                    <ActivityIndicator color={TEAL} accessibilityLabel={t("common.loading")} />
                    <Text style={styles.muted}>{t("common.loading")}</Text>
                  </View>
                ) : (
                  <Button title={t("login.signIn")} onPress={signIn} />
                )}
              </View>

              <Text
                style={styles.link}
                onPress={() =>
                  Alert.alert(
                    t("login.comingSoon"),
                    t("login.activationUnavailable"),
                  )
                }
              >
                {t(info.help)}
              </Text>
            </View>
          )}

          {page === "dashboard" && user && user.role === role && (
            <View>
              <LanguageSwitcher />
              <Text style={styles.tag}>EDUTRACK</Text>

              <Text style={styles.bigTitle}>
                {t(user?.role === "teacher" ? "dashboard.teacher" : "dashboard.student")}
              </Text>

              <Text style={styles.muted}>
                {t("dashboard.welcome", { name: user?.name || t("dashboard.defaultUser") })}
              </Text>

              <View style={styles.roleCard}>
                <Text style={styles.cardTitle}>✓ {t("dashboard.loginSuccessful")}</Text>
                <Text style={styles.muted}>
                  {t("dashboard.comingSoon")}
                </Text>
              </View>

              {role === "teacher" && user.role === "teacher" && (
                <View style={styles.roleCard}>
                  <Button
                    title={t("dashboard.loadTeacherData")}
                    onPress={loadTeacherData}
                    disabled={teacherLoading}
                  />
                  {teacherLoading && (
                    <View accessibilityLiveRegion="polite">
                      <ActivityIndicator color={TEAL} accessibilityLabel={t("common.loading")} />
                      <Text style={styles.muted}>{t("common.loading")}</Text>
                    </View>
                  )}
                  {!!teacherError && (
                    <Text style={styles.errorText}>{teacherError.key ? t(teacherError.key) : teacherError.message}</Text>
                  )}
                  {teacherData && teacherData.id === user.id && (
                    <View>
                      <Text style={styles.cardTitle}>{teacherData.name}</Text>
                      <Text style={styles.muted}>{t("dashboard.roleLabel")}: {teacherData.role}</Text>
                      <Text style={styles.muted}>{t("dashboard.identifierLabel")}: {teacherData.identifier}</Text>
                    </View>
                  )}
                </View>
              )}

              <Button
                title={t("dashboard.logout")}
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
                      t("auth.logoutFailureTitle"),
                      t("auth.logoutFailure"),
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
