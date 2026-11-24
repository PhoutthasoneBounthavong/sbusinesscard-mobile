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
    background: "#F7F4EC", // Warm luxury cream/ivory linen paper (not stark white)
    surface: "#FFFFFF", // Crisp contrast card surface
    surfaceElevated: "#EFECE3", // Warm cream secondary container
    surfaceSecondary: "#E8E3D7", // Soft warm oat
    headerBg: "#F0EBE0", // Warm cream translucent header
    tabBarBg: "#F0EBE0", // Warm cream bottom tab bar
    border: "rgba(50, 42, 30, 0.10)", // Subtle warm stone divider
    borderSubtle: "rgba(50, 42, 30, 0.05)",
    textPrimary: "#1F1D1A", // Rich espresso charcoal (never harsh black)
    textSecondary: "#6B655B", // Warm stone taupe
    textMuted: "#969085", // Muted taupe
    inputBg: "#FFFFFF",
    inputBorder: "rgba(50, 42, 30, 0.16)",
    accent: "#0071E3", // Apple vibrant royal blue
    accentLight: "#0071E3",
    accentSoft: "rgba(0, 113, 227, 0.10)",
    statusBarStyle: "dark-content",
    cardBg: "#FFFFFF",
    cardBorder: "rgba(50, 42, 30, 0.08)",
    shadowColor: "#322A1E",
    badgeBg: "rgba(0, 113, 227, 0.08)",
    badgeBorder: "rgba(0, 113, 227, 0.22)",
    pillActiveBg: "#1F1D1A",
    pillActiveText: "#FFFFFF",
    pillInactiveBg: "#E6E0D2",
    pillInactiveText: "#6B655B",
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
