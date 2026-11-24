import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const THEMES = {
  dark: {
    id: "dark",
    isDark: true,
    background: "#000000",
    surface: "#1C1C1E",
    surfaceElevated: "#2C2C2E",
    surfaceSecondary: "#141416",
    headerBg: "#121214",
    tabBarBg: "#121214",
    border: "rgba(255, 255, 255, 0.12)",
    borderSubtle: "rgba(255, 255, 255, 0.06)",
    textPrimary: "#FFFFFF",
    textSecondary: "#8E8E93",
    textMuted: "#636366",
    inputBg: "#1C1C1E",
    inputBorder: "rgba(255, 255, 255, 0.15)",
    accent: "#0A84FF",
    accentLight: "#409CFF",
    accentSoft: "rgba(10, 132, 255, 0.15)",
    statusBarStyle: "light-content",
    cardBg: "#18181A",
    cardBorder: "rgba(255, 255, 255, 0.10)",
    shadowColor: "#000000",
    badgeBg: "rgba(10, 132, 255, 0.15)",
    badgeBorder: "rgba(10, 132, 255, 0.3)",
    pillActiveBg: "#FFFFFF",
    pillActiveText: "#000000",
    pillInactiveBg: "#1C1C1E",
    pillInactiveText: "#8E8E93",
  },
  light: {
    id: "light",
    isDark: false,
    background: "#FAF7F2", // Anthropic Claude's exact signature warm parchment cream
    surface: "#FFFFFF", // Crisp contrast card surface
    surfaceElevated: "#F3EEE5", // Claude's warm soft cream container
    surfaceSecondary: "#EAE3D6", // Soft warm parchment oat
    headerBg: "#F5F0E6", // Claude's warm parchment header
    tabBarBg: "#F5F0E6", // Claude's warm parchment bottom tab bar
    border: "rgba(90, 75, 55, 0.14)", // Warm terracotta stone divider
    borderSubtle: "rgba(90, 75, 55, 0.07)",
    textPrimary: "#2E2825", // Claude's exact warm deep charcoal (gentle and rich)
    textSecondary: "#736B66", // Warm clay/stone secondary text
    textMuted: "#9C948D", // Warm muted taupe
    inputBg: "#FFFFFF",
    inputBorder: "rgba(90, 75, 55, 0.20)",
    accent: "#0071E3", // Professional vibrant accent
    accentLight: "#0071E3",
    accentWarm: "#CC785C", // Claude's warm terracotta highlight
    accentSoft: "rgba(0, 113, 227, 0.10)",
    statusBarStyle: "dark-content",
    cardBg: "#FFFFFF",
    cardBorder: "rgba(90, 75, 55, 0.10)",
    shadowColor: "#32271E",
    badgeBg: "rgba(0, 113, 227, 0.08)",
    badgeBorder: "rgba(0, 113, 227, 0.22)",
    pillActiveBg: "#2E2825",
    pillActiveText: "#FFFFFF",
    pillInactiveBg: "#E8E2D5",
    pillInactiveText: "#736B66",
  },
};

const THEME_STORAGE_KEY = "@sbusinesscard_theme_mode";

const ThemeContext = createContext({
  theme: THEMES.dark,
  themeMode: "dark",
  isDark: true,
  toggleTheme: () => {},
  setThemeMode: () => {},
});

export function ThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState("dark");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === "light" || savedMode === "dark") {
          setThemeModeState(savedMode);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = async (mode) => {
    if (mode === "light" || mode === "dark") {
      setThemeModeState(mode);
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch (e) {}
    }
  };

  const toggleTheme = () => {
    const nextMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
  };

  const theme = THEMES[themeMode] || THEMES.dark;
  const isDark = themeMode === "dark";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        isDark,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
