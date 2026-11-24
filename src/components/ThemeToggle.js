import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      activeOpacity={0.85}
      style={[
        styles.track,
        {
          backgroundColor: isDark ? "#1C1C1E" : "#E8E2D5",
          borderColor: isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(90, 75, 55, 0.22)",
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isDark ? "Claude Cream Light" : "Dark"} theme`}
    >
      {/* Light Segment (Sun) */}
      <View
        style={[
          styles.circleThumb,
          !isDark && styles.activeCircleLight,
        ]}
      >
        <Ionicons
          name={!isDark ? "sunny" : "sunny-outline"}
          size={14}
          color={!isDark ? "#D97706" : "rgba(255, 255, 255, 0.35)"}
        />
      </View>

      {/* Dark Segment (Moon) */}
      <View
        style={[
          styles.circleThumb,
          isDark && styles.activeCircleDark,
        ]}
      >
        <Ionicons
          name={isDark ? "moon" : "moon-outline"}
          size={13}
          color={isDark ? "#409CFF" : "rgba(90, 75, 55, 0.45)"}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 66,
    height: 34,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    borderWidth: 1,
    overflow: "hidden",
  },
  circleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  activeCircleLight: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.16,
    shadowRadius: 2.5,
    elevation: 3,
  },
  activeCircleDark: {
    backgroundColor: "#2C2C2E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.35,
    shadowRadius: 2.5,
    elevation: 3,
  },
});
