import React, { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { SinhalaFontProvider } from "./components/SinhalaTypography";
import {
  LocalizedText,
  LocalizedTextInput,
} from "./components/LocalizedTypography";
import StudentDashboard from "./components/StudentDashboard";
import MyClassesScreen from "./components/MyClassesScreen";
import { fetchStudentClasses, isValidClassList } from "./api/studentClasses";
import { fetchStudentMaterials } from "./api/studentMaterials";
import StudentQRCardScreen from "./components/StudentQRCardScreen";
import LearningMaterialsScreen from "./components/LearningMaterialsScreen";
import {
  downloadStudentPdf,
  getDownloadedPdfIds,
  isPdfMaterial,
  viewSavedPdf,
} from "./api/studentPdfDownloads";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
      <LocalizedText style={[styles.buttonText, light && { color: BLUE }]}>
        {title}
      </LocalizedText>
    </TouchableOpacity>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <SinhalaFontProvider>
        <AppContent />
      </SinhalaFontProvider>
    </LanguageProvider>
  );
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
  const [selectedClass, setSelectedClass] = useState(null);
  const [pdfState, setPdfState] = useState(null);
  const pdfScope = useRef(null);
  const [classList, setClassList] = useState(null);
  const [classAttempt, setClassAttempt] = useState(0);
  const [materialList, setMaterialList] = useState(null);
  const [materialAttempt, setMaterialAttempt] = useState(0);
  const [teacherData, setTeacherData] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const sessionCheck = useRef(0);
  const studentId =
    role === "student" && user?.role === "student" ? user.id : null;
  const materialClassId =
    page === "learningMaterials" ? selectedClass?.id : null;

  useEffect(() => {
    if (page !== "myClasses" || !studentId) return;

    const session = sessionCheck.current;
    const controller = new AbortController();
    const isCurrent = () =>
      !controller.signal.aborted && sessionCheck.current === session;
    const publish = (result) =>
      setClassList({ studentId, session, attempt: classAttempt, result });
    const timeout = setTimeout(() => {
      if (isCurrent())
        publish({ status: "error", errorKey: "student.connectionError" });
      controller.abort();
    }, 10000);

    fetchStudentClasses({
      apiUrl: API_URL,
      readToken: () => SecureStore.getItemAsync("edutrack_token"),
      signal: controller.signal,
    }).then((result) => {
      clearTimeout(timeout);
      if (isCurrent()) publish(result);
    });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [page, studentId, classAttempt]);

  useEffect(() => {
    if (!materialClassId || !studentId) return;

    const session = sessionCheck.current;
    const controller = new AbortController();
    const isCurrent = () =>
      !controller.signal.aborted && sessionCheck.current === session;
    const publish = (result) =>
      setMaterialList({
        classId: materialClassId,
        studentId,
        session,
        attempt: materialAttempt,
        result,
      });
    const timeout = setTimeout(() => {
      if (isCurrent())
        publish({ status: "error", errorKey: "materials.connectionError" });
      controller.abort();
    }, 10000);

    fetchStudentMaterials({
      apiUrl: API_URL,
      classId: materialClassId,
      readToken: () => SecureStore.getItemAsync("edutrack_token"),
      signal: controller.signal,
    }).then((result) => {
      clearTimeout(timeout);
      if (isCurrent()) publish(result);
    });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [materialClassId, studentId, materialAttempt]);

  useEffect(() => {
    setSelectedClass(null);
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (
      !["myClasses", "studentQRCard", "learningMaterials"].includes(page) ||
      role !== "student" ||
      user?.role !== "student"
    )
      return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        goBackFromStudentPage();
        return true;
      },
    );
    return () => subscription.remove();
  }, [page, role, user?.role]);

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
    setSelectedClass(null);
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
        typeof data.user.id !== "string" ||
        !data.user.id ||
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
    setSelectedClass(null);
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
        setError(
          typeof data.message === "string" && data.message
            ? { message: data.message }
            : { key: "auth.signInFailure" },
        );
      } else if (data.user.role !== role) {
        setError({ key: "auth.roleMismatch" });
      } else {
        await SecureStore.setItemAsync("edutrack_token", data.token);
        setSelectedClass(null);
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
        setTeacherError(
          typeof data.message === "string" && data.message
            ? { message: data.message }
            : { key: "auth.teacherDataFailure" },
        );
      } else if (
        !data.user ||
        data.user.role !== "teacher" ||
        data.user.id !== user.id
      ) {
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

  async function logOut() {
    sessionCheck.current += 1;
    pdfScope.current?.controller.abort();
    setClassList(null);
    setTeacherLoading(false);
    try {
      await SecureStore.deleteItemAsync("edutrack_token");
      setUser(null);
      setSelectedClass(null);
      setPassword("");
      setPage("welcome");
    } catch {
      Alert.alert(t("auth.logoutFailureTitle"), t("auth.logoutFailure"));
    }
  }

  function goBackFromStudentPage() {
    pdfScope.current?.controller.abort();
    setSelectedClass(null);
    setClassList(null);
    setMaterialList(null);
    setPage(page === "learningMaterials" ? "myClasses" : "dashboard");
  }

  function openStudentPage(nextPage) {
    if (role !== "student" || user?.role !== "student") return;
    setSelectedClass(null);
    setClassList(null);
    setPage(nextPage);
  }

  function selectStudentClass(classItem) {
    if (page !== "myClasses" || role !== "student" || user?.role !== "student")
      return;
    if (!isValidClassList([classItem])) return;
    setMaterialList(null);
    setSelectedClass(classItem);
    setPage("learningMaterials");
  }

  const info = ROLES[role];
  const classResult =
    classList &&
    classList.studentId === studentId &&
    classList.session === sessionCheck.current &&
    classList.attempt === classAttempt
      ? classList.result
      : null;
  const materialResult =
    materialList &&
    materialList.classId === materialClassId &&
    materialList.studentId === studentId &&
    materialList.session === sessionCheck.current &&
    materialList.attempt === materialAttempt
      ? materialList.result
      : null;
  const showLearningMaterials =
    page === "learningMaterials" &&
    role === "student" &&
    user?.role === "student";

  const listedMaterials = materialResult?.materials;
  useEffect(() => {
    if (!studentId || !materialClassId || !listedMaterials) return;

    const scope = {
      controller: new AbortController(),
      session: sessionCheck.current,
      materials: listedMaterials,
      pending: new Set(),
    };
    pdfScope.current = scope;
    Promise.resolve().then(() => {
      if (!scope.controller.signal.aborted && scope.session === sessionCheck.current) {
        const saved = getDownloadedPdfIds(studentId, materialClassId, listedMaterials);
        setPdfState((previous) => ({ scope, saved,
          feedback: previous?.scope === scope ? previous.feedback : {},
        }));
      }
    });

    return () => {
      scope.controller.abort();
      if (pdfScope.current === scope) pdfScope.current = null;
    };
  }, [studentId, materialClassId, listedMaterials]);

  function isCurrentPdfScope(scope) {
    return scope && pdfScope.current === scope && !scope.controller.signal.aborted &&
      scope.session === sessionCheck.current;
  }

  async function runPdfAction(material, open) {
    const scope = pdfScope.current;
    if (!isCurrentPdfScope(scope) || scope.materials !== listedMaterials ||
        !listedMaterials.includes(material) || !isPdfMaterial(material) ||
        scope.pending.has(material.id)) return;

    const update = (key, refresh = false) => {
      if (!isCurrentPdfScope(scope)) return;
      const saved = refresh ? getDownloadedPdfIds(studentId, materialClassId, listedMaterials) : null;
      setPdfState((previous) => {
        const current = previous?.scope === scope ? previous : { scope, saved: [], feedback: {} };
        return { ...current, saved: saved ?? current.saved, feedback: { ...current.feedback, [material.id]: key } };
      });
    };
    scope.pending.add(material.id);
    try {
      if (open) {
        await viewSavedPdf({ studentId, classId: materialClassId, material });
        update(null);
      } else {
        update("materials.downloading");
        await downloadStudentPdf({
          apiUrl: API_URL,
          studentId,
          classId: materialClassId,
          material,
          readToken: () => SecureStore.getItemAsync("edutrack_token"),
          signal: scope.controller.signal,
        });
        update("materials.pdfSaved", true);
      }
    } catch {
      update(open ? "materials.pdfUnavailable" : "materials.downloadFailed", true);
    } finally {
      scope.pending.delete(material.id);
    }
  }

  const visiblePdfState = pdfState?.scope.materials === listedMaterials && isCurrentPdfScope(pdfState?.scope)
    ? pdfState : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {showLearningMaterials ? (
          <View style={styles.materialsScreen}>
              <LearningMaterialsScreen
                key={selectedClass?.id || "unselected"}
                selectedClass={selectedClass}
                {...(materialResult || {
                  status: materialClassId ? "loading" : "idle",
                })}
                onRetry={() => setMaterialAttempt(materialAttempt + 1)}
                onBack={goBackFromStudentPage}
                downloadedMaterialIds={visiblePdfState?.saved}
                pdfFeedback={visiblePdfState?.feedback}
                onDownload={listedMaterials ? (material) => runPdfAction(material, false) : undefined}
                onView={listedMaterials ? (material) => runPdfAction(material, true) : undefined}
              />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {page === "checkingSession" && (
              <View>
                <ActivityIndicator color={TEAL} />
                <LocalizedText style={styles.muted}>
                  {t("auth.checkingSession")}
                </LocalizedText>
              </View>
            )}

            {page === "sessionError" && (
              <View>
                <LanguageSwitcher />
                <LocalizedText style={styles.errorText}>
                  {sessionError ? t(sessionError) : ""}
                </LocalizedText>
                <Button
                  title={t("auth.retrySession")}
                  onPress={restoreSession}
                />
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
                <LocalizedText style={styles.tag}>
                  {t("welcome.tagline")}
                </LocalizedText>

                <LocalizedText style={styles.title}>
                  {t("welcome.heading")}
                </LocalizedText>

                <View style={styles.art}>
                  <Text style={{ fontSize: 92 }}>📖</Text>
                  <Text style={styles.artCheck}>✓</Text>
                </View>

                <LocalizedText style={styles.bigTitle}>
                  {t("welcome.description")}
                </LocalizedText>

                <LocalizedText style={styles.muted}>
                  {t("welcome.supportingText")}
                </LocalizedText>

                <Button
                  title={t("welcome.getStarted")}
                  onPress={() => setPage("roles")}
                />

                <LocalizedText style={styles.small}>
                  {t("welcome.audience")}
                </LocalizedText>
              </View>
            )}

            {page === "roles" && (
              <View>
                <LocalizedText
                  style={styles.back}
                  onPress={() => setPage("welcome")}
                >
                  ‹ {t("welcome.back")}
                </LocalizedText>

                <LocalizedText style={styles.title}>
                  {t("roles.heading")}
                </LocalizedText>
                <LocalizedText style={styles.muted}>
                  {t("roles.description")}
                </LocalizedText>

                <View style={styles.studentCard}>
                  <LocalizedText style={styles.whiteSmall}>
                    {t("roles.forLearners")}
                  </LocalizedText>

                  <LocalizedText style={styles.studentTitle}>
                    {t("roles.progress")}
                  </LocalizedText>

                  <LocalizedText style={styles.whiteSmall}>
                    {t("roles.studentDescription")}
                  </LocalizedText>

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
                  <LocalizedText style={styles.cardTitle}>
                    {t("roles.teacher")}
                  </LocalizedText>
                  <LocalizedText style={styles.muted}>
                    {t("roles.teacherDescription")}
                  </LocalizedText>
                  <LocalizedText style={styles.link}>
                    {t("roles.continueTeacher")}
                  </LocalizedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.roleCard}
                  onPress={() => chooseRole("parent")}
                >
                  <LocalizedText style={styles.cardTitle}>
                    {t("roles.parent")}
                  </LocalizedText>
                  <LocalizedText style={styles.muted}>
                    {t("roles.parentDescription")}
                  </LocalizedText>
                  <LocalizedText style={styles.link}>
                    {t("roles.continueParent")}
                  </LocalizedText>
                </TouchableOpacity>

                <LocalizedText
                  style={styles.link}
                  onPress={() => chooseRole("admin")}
                >
                  {t("roles.adminAccess")}
                </LocalizedText>
              </View>
            )}

            {page === "login" && (
              <View>
                <LanguageSwitcher />
                <LocalizedText
                  style={styles.back}
                  onPress={() => {
                    setError("");
                    setPage("roles");
                  }}
                >
                  ‹ {t("login.secureAccess")}
                </LocalizedText>

                <LocalizedText style={styles.title}>
                  {t(info.title)}
                </LocalizedText>
                <LocalizedText style={styles.link}>
                  {t(`roles.${role}`)}
                </LocalizedText>

                <LocalizedText style={styles.muted}>
                  {t("login.welcomeBack")}
                </LocalizedText>

                {!!error && (
                  <View style={styles.errorBox}>
                    <LocalizedText style={styles.errorTitle}>
                      {t("login.unsuccessful")}
                    </LocalizedText>
                    {error.key ? (
                      <LocalizedText style={styles.errorText}>
                        {t(error.key)}
                      </LocalizedText>
                    ) : (
                      <Text style={styles.errorText}>{error.message}</Text>
                    )}
                  </View>
                )}

                <LocalizedText style={styles.fieldLabel}>
                  {t(info.label)}
                </LocalizedText>
                <LocalizedTextInput
                  style={styles.input}
                  placeholder={info.hint}
                  value={identifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={
                    role === "student" ? "default" : "email-address"
                  }
                  onChangeText={setIdentifier}
                />

                <LocalizedText style={styles.fieldLabel}>
                  {t("login.password")}
                </LocalizedText>
                <LocalizedTextInput
                  style={styles.input}
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!visible}
                  autoCapitalize="none"
                />

                <LocalizedText style={styles.small}>
                  {t("login.passwordHint")}
                </LocalizedText>

                <LocalizedText
                  style={styles.link}
                  onPress={() => setVisible(!visible)}
                >
                  {t(visible ? "login.hidePassword" : "login.showPassword")}
                </LocalizedText>

                <LocalizedText
                  style={styles.link}
                  onPress={() =>
                    Alert.alert(
                      t("login.comingSoon"),
                      t("login.passwordRecoveryUnavailable"),
                    )
                  }
                >
                  {t("login.forgotPassword")}
                </LocalizedText>

                <View style={{ marginTop: 14 }}>
                  {loading ? (
                    <View accessibilityLiveRegion="polite">
                      <ActivityIndicator
                        color={TEAL}
                        accessibilityLabel={t("common.loading")}
                      />
                      <LocalizedText style={styles.muted}>
                        {t("common.loading")}
                      </LocalizedText>
                    </View>
                  ) : (
                    <Button title={t("login.signIn")} onPress={signIn} />
                  )}
                </View>

                <LocalizedText
                  style={styles.link}
                  onPress={() =>
                    Alert.alert(
                      t("login.comingSoon"),
                      t("login.activationUnavailable"),
                    )
                  }
                >
                  {t(info.help)}
                </LocalizedText>
              </View>
            )}

            {page === "dashboard" &&
              user &&
              user.role === role &&
              role === "student" && (
                <StudentDashboard
                  student={user}
                  onLogout={logOut}
                  onMyClasses={() => openStudentPage("myClasses")}
                  onMyQRCard={() => openStudentPage("studentQRCard")}
                  onLearningMaterials={() =>
                    openStudentPage("learningMaterials")
                  }
                />
              )}

            {page === "myClasses" &&
              user &&
              user.role === role &&
              role === "student" && (
                <MyClassesScreen
                  {...(classResult || { status: "loading" })}
                  onBack={goBackFromStudentPage}
                  onRetry={() => setClassAttempt(classAttempt + 1)}
                  onSelectClass={selectStudentClass}
                />
              )}

            {page === "studentQRCard" &&
              user &&
              user.role === role &&
              role === "student" && (
                <StudentQRCardScreen
                  student={user}
                  onBack={goBackFromStudentPage}
                />
              )}

            {page === "dashboard" &&
              user &&
              user.role === role &&
              role === "teacher" && (
                <View>
                  <LanguageSwitcher />
                  <Text style={styles.tag}>EDUTRACK</Text>

                  <LocalizedText style={styles.bigTitle}>
                    {t(
                      user?.role === "teacher"
                        ? "dashboard.teacher"
                        : "dashboard.student",
                    )}
                  </LocalizedText>

                  <LocalizedText style={styles.muted}>
                    {t("dashboard.welcome", {
                      name: user?.name || t("dashboard.defaultUser"),
                    })}
                  </LocalizedText>

                  <View style={styles.roleCard}>
                    <LocalizedText style={styles.cardTitle}>
                      ✓ {t("dashboard.loginSuccessful")}
                    </LocalizedText>
                    <LocalizedText style={styles.muted}>
                      {t("dashboard.comingSoon")}
                    </LocalizedText>
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
                          <ActivityIndicator
                            color={TEAL}
                            accessibilityLabel={t("common.loading")}
                          />
                          <LocalizedText style={styles.muted}>
                            {t("common.loading")}
                          </LocalizedText>
                        </View>
                      )}
                      {!!teacherError &&
                        (teacherError.key ? (
                          <LocalizedText style={styles.errorText}>
                            {t(teacherError.key)}
                          </LocalizedText>
                        ) : (
                          <Text style={styles.errorText}>
                            {teacherError.message}
                          </Text>
                        ))}
                      {teacherData && teacherData.id === user.id && (
                        <View>
                          <Text style={styles.cardTitle}>
                            {teacherData.name}
                          </Text>
                          <Text style={styles.muted}>
                            <LocalizedText>
                              {t("dashboard.roleLabel")}:{" "}
                            </LocalizedText>
                            {teacherData.role}
                          </Text>
                          <Text style={styles.muted}>
                            <LocalizedText>
                              {t("dashboard.identifierLabel")}:{" "}
                            </LocalizedText>
                            {teacherData.identifier}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Button title={t("dashboard.logout")} onPress={logOut} />
                </View>
              )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  materialsScreen: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
    flex: 1,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
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
