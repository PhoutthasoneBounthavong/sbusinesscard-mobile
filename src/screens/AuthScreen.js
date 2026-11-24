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

export default function AuthScreen({ onAuthSuccess, insets }) {
  const { showAlert } = useAlert();
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: (insets?.top || 20) + 20,
            paddingBottom: (insets?.bottom || 20) + 30,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* App Branding */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="card" size={40} color="#0A84FF" />
          </View>
          <Text style={styles.title}>SBusinessCard</Text>
          <Text style={styles.subtitle}>
            Business Card Scanner
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, !isRegister && styles.segmentActive]}
            onPress={() => setIsRegister(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, !isRegister && styles.segmentTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, isRegister && styles.segmentActive]}
            onPress={() => setIsRegister(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, isRegister && styles.segmentTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Inputs */}
        <View style={styles.formCard}>
          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color="#86868B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Business Card"
                  placeholderTextColor="#636366"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>WORK EMAIL</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#86868B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="name@sbusinesscard.app"
                placeholderTextColor="#636366"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#86868B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor="#636366"
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
                  color="#86868B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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
