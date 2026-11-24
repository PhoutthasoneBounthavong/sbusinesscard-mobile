import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { loginUser, registerUser } from "../api";
import { useAlert } from "../context/AlertContext";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

export default function AuthScreen({ onAuthSuccess, insets }) {
  const { showAlert } = useAlert();
  const { theme, isDark } = useTheme();
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showAlert({
        title: "Missing Email",
        message: "Please enter your email address.",
        type: "warning",
      });
      return;
    }
    if (!password || password.length < 6) {
      showAlert({
        title: "Invalid Password",
        message: "Password must be at least 6 characters long.",
        type: "warning",
      });
      return;
    }

    if (isRegister && !fullName.trim()) {
      showAlert({
        title: "Missing Name",
        message: "Please enter your full name.",
        type: "warning",
      });
      return;
    }

    setLoading(true);
    try {
      let data;
      if (isRegister) {
        data = await registerUser(trimmedEmail, password, fullName.trim());
      } else {
        data = await loginUser(trimmedEmail, password);
      }
      if (data && data.user) {
        onAuthSuccess(data.user);
      }
    } catch (err) {
      showAlert({
        title: isRegister ? "Registration Failed" : "Sign In Failed",
        message: err.message || "Please check your details and try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // const handleQuickDemoLogin = async () => {
  //   setLoading(true);
  //   try {
  //     const data = await loginUser("******", "*****");
  //     if (data && data.user) {
  //       onAuthSuccess(data.user);
  //     }
  //   } catch (err) {
  //     showAlert({
  //       title: "Demo Login Failed",
  //       message: err.message,
  //       type: "error",
  //     });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: (insets?.top || 20) + 10,
            paddingBottom: (insets?.bottom || 20) + 30,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Right Theme Toggle */}
        <View style={{ alignItems: "flex-end", width: "100%", paddingHorizontal: 4, marginBottom: 16 }}>
          <ThemeToggle />
        </View>

        {/* App Branding */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? "rgba(10, 132, 255, 0.15)" : "#EBE5D8" }]}>
            <Ionicons name="card" size={40} color={theme.accent} />
          </View>
          <Text style={[styles.title, { color: theme.textPrimary }]}>SBusinessCard</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Business Card Scanner
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.segmentContainer, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E8E2D5" }]}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              !isRegister && [styles.segmentActive, { backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF" }],
            ]}
            onPress={() => setIsRegister(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, { color: !isRegister ? theme.textPrimary : theme.textSecondary }]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              isRegister && [styles.segmentActive, { backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF" }],
            ]}
            onPress={() => setIsRegister(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, { color: isRegister ? theme.textPrimary : theme.textSecondary }]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Inputs */}
        <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>FULL NAME</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Ionicons name="person-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textPrimary }]}
                  placeholder="e.g. Business Card"
                  placeholderTextColor={theme.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>WORK EMAIL</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="mail-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="name@sbusinesscard.app"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>PASSWORD</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                placeholder="At least 6 characters"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.accent }, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegister ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Demo Login Quick Action
        <View style={styles.demoSection}>
          <Text style={styles.demoHint}>Looking to test quickly?</Text>
          <TouchableOpacity
            style={styles.demoButton}
            onPress={handleQuickDemoLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Ionicons name="flash-outline" size={16} color="#0A84FF" />
            <Text style={styles.demoButtonText}>1-Tap Demo Account Login</Text>
          </TouchableOpacity>
        </View> */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingHorizontal: 24,
    justifyContent: "center",
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "rgba(10, 132, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#86868B",
    marginTop: 6,
    textAlign: "center",
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    padding: 3,
    marginBottom: 24,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 11,
  },
  segmentActive: {
    backgroundColor: "#2C2C2E",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#86868B",
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: "#161618",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#86868B",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#242426",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 46,
    color: "#FFFFFF",
    fontSize: 15,
  },
  eyeButton: {
    padding: 8,
  },
  submitButton: {
    backgroundColor: "#0A84FF",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  demoSection: {
    alignItems: "center",
    marginTop: 28,
  },
  demoHint: {
    fontSize: 12,
    color: "#636366",
    marginBottom: 8,
  },
  demoButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(10, 132, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.2)",
    gap: 6,
  },
  demoButtonText: {
    color: "#0A84FF",
    fontSize: 13,
    fontWeight: "600",
  },
});
