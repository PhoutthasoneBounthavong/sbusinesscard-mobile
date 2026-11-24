import React, { createContext, useContext, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const AlertContext = createContext(null);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

export function AlertProvider({ children }) {
  const [alertState, setAlertState] = useState(null);

  const showAlert = ({
    title,
    message,
    type = "info", // "success" | "warning" | "error" | "destructive" | "info"
    buttons = [{ text: "OK", style: "default" }],
  }) => {
    setAlertState({ title, message, type, buttons });
  };

  const hideAlert = () => {
    setAlertState(null);
  };

  const getIconConfig = (type) => {
    switch (type) {
      case "success":
        return { name: "checkmark-circle", color: "#30D158", bg: "rgba(48, 209, 88, 0.14)" };
      case "warning":
        return { name: "alert-circle", color: "#FFD60A", bg: "rgba(255, 214, 10, 0.14)" };
      case "destructive":
        return { name: "trash", color: "#FF453A", bg: "rgba(255, 69, 58, 0.14)" };
      case "error":
        return { name: "close-circle", color: "#FF453A", bg: "rgba(255, 69, 58, 0.14)" };
      default:
        return { name: "information-circle", color: "#0A84FF", bg: "rgba(10, 132, 255, 0.14)" };
    }
  };

  const iconConfig = alertState ? getIconConfig(alertState.type) : null;

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      <Modal
        visible={!!alertState}
        transparent={true}
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={hideAlert}>
            <View style={styles.dismissArea} />
          </TouchableWithoutFeedback>

          <View style={styles.alertCard}>
            {/* Top Icon Badge */}
            {iconConfig && (
              <View style={[styles.iconWrapper, { backgroundColor: iconConfig.bg }]}>
                <Ionicons name={iconConfig.name} size={30} color={iconConfig.color} />
              </View>
            )}

            {/* Title & Message */}
            {!!alertState?.title && <Text style={styles.title}>{alertState.title}</Text>}
            {!!alertState?.message && <Text style={styles.message}>{alertState.message}</Text>}

            {/* Action Buttons */}
            <View style={styles.buttonStack}>
              {alertState?.buttons?.map((btn, index) => {
                const isDestructive = btn.style === "destructive";
                const isCancel = btn.style === "cancel";
                const isPrimary = !isCancel && !isDestructive && (index === 0 || alertState.buttons.length === 1);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.btnBase,
                      isPrimary && styles.btnPrimary,
                      isDestructive && styles.btnDestructive,
                      isCancel && styles.btnCancel,
                    ]}
                    onPress={() => {
                      hideAlert();
                      if (btn.onPress) btn.onPress();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.btnTextBase,
                        isPrimary && styles.btnTextPrimary,
                        isDestructive && styles.btnTextDestructive,
                        isCancel && styles.btnTextCancel,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  alertCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#1C1C1E",
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  iconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#98989D",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  buttonStack: {
    width: "100%",
    gap: 9,
  },
  btnBase: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2C2C2E",
  },
  btnPrimary: {
    backgroundColor: "#0A84FF",
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDestructive: {
    backgroundColor: "rgba(255, 69, 58, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 69, 58, 0.3)",
  },
  btnCancel: {
    backgroundColor: "transparent",
  },
  btnTextBase: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  btnTextPrimary: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  btnTextDestructive: {
    color: "#FF453A",
    fontWeight: "700",
  },
  btnTextCancel: {
    color: "#8E8E93",
    fontWeight: "500",
  },
});
