import React from "react";
import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
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
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E4DECFA0",
          borderColor: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(60, 50, 40, 0.15)",
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isDark ? "Light Cream" : "Dark"} theme`}
    >
      {/* Light Segment */}
      <View
        style={[
          styles.segment,
          !isDark && [
            styles.activeThumbLight,
            {
              shadowColor: "#000",
            },
          ],
        ]}
      >
        <Ionicons
          name={!isDark ? "sunny" : "sunny-outline"}
          size={14}
          color={!isDark ? "#D97706" : "rgba(255, 255, 255, 0.4)"}
        />
      </View>

      {/* Dark Segment */}
      <View
        style={[
          styles.segment,
          isDark && [
            styles.activeThumbDark,
            {
              shadowColor: "#000",
            },
          ],
        ]}
      >
        <Ionicons
          name={isDark ? "moon" : "moon-outline"}
          size={13}
          color={isDark ? "#409CFF" : "rgba(60, 50, 40, 0.4)"}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 62,
    height: 30,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 3,
    borderWidth: 1,
  },
  segment: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeThumbLight: {
    backgroundColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  activeThumbDark: {
    backgroundColor: "#2C2C2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
});
