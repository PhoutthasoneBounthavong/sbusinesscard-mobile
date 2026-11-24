import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ScannerScreen from "./src/screens/ScannerScreen";
import CardsVaultScreen from "./src/screens/CardsVaultScreen";
import MyDigitalCardScreen from "./src/screens/MyDigitalCardScreen";
import AuthScreen from "./src/screens/AuthScreen";
import { getStoredUser, getStoredToken, logoutUser } from "./src/api";
import { AlertProvider, useAlert } from "./src/context/AlertContext";

function MainApp({ user, onLogout }) {
  const [currentTab, setCurrentTab] = useState("vault"); // 'vault' (default home) | 'scan' | 'card'
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const tabs = [
    {
      id: "vault",
      label: "Cards Vault",
      icon: "albums-outline",
      activeIcon: "albums",
    },
    {
      id: "scan",
      label: "Scan Card",
      icon: "camera-outline",
      activeIcon: "camera",
    },
    {
      id: "card",
      label: "My Card",
      icon: "card-outline",
      activeIcon: "card",
    },
  ];

  // Inset calculation
  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 20 : 10);
  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0
  );

  const handleSignOutPrompt = () => {
    showAlert({
      title: "Sign Out",
      message: `Are you sure you want to sign out from ${user?.email || "your account"}?`,
      type: "destructive",
      buttons: [
        {
          text: "Sign Out",
          style: "destructive",
          onPress: onLogout,
        },
        { text: "Cancel", style: "cancel" },
      ],
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Top User Account Bar (Apple HIG Translucent Header - always visible across all tabs) */}
      <View style={[styles.accountBar, { paddingTop: topInset + 6 }]}>
        <View style={styles.userBadge}>
          <View style={styles.userAvatarCircle}>
            <Text style={styles.avatarInitial}>
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.full_name || "My Business Account"}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || "Signed In"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOutPrompt}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={17} color="#FF453A" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Screen Views */}
      <View style={styles.screenContainer}>
        {currentTab === "scan" && (
          <ScannerScreen
            insets={insets}
            onNavigateToVault={() => setCurrentTab("vault")}
            onClose={() => setCurrentTab("vault")}
          />
        )}
        {currentTab === "vault" && (
          <CardsVaultScreen
            insets={insets}
            key={user?.id}
            onNavigateToScan={() => setCurrentTab("scan")}
          />
        )}
        {currentTab === "card" && <MyDigitalCardScreen insets={insets} />}
      </View>

      {/* Apple-styled Bottom Tab Bar */}
      <View
        style={[
          styles.tabBarWrapper,
          {
            paddingBottom: bottomInset,
          },
        ]}
      >
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setCurrentTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={22}
                  color={isActive ? "#409CFF" : "#86868B"}
                  style={{ marginBottom: 3 }}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedUser, token] = await Promise.all([
          getStoredUser(),
          getStoredToken(),
        ]);
        if (storedUser && token) {
          setUser(storedUser);
        }
      } catch (err) {
        console.warn("Auth check failed:", err);
      } finally {
        setCheckingAuth(false);
      }
    }
    loadAuth();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
  };

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A84FF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AlertProvider>
        {user ? (
          <MainApp user={user} onLogout={handleLogout} />
        ) : (
          <AuthScreen onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />
        )}
      </AlertProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  accountBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#121214",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  userAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  userEmail: {
    color: "#86868B",
    fontSize: 11,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 69, 58, 0.12)",
    gap: 4,
  },
  signOutText: {
    color: "#FF453A",
    fontSize: 12,
    fontWeight: "600",
  },
  screenContainer: {
    flex: 1,
  },
  tabBarWrapper: {
    backgroundColor: "#121214",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBar: {
    flexDirection: "row",
    height: 56,
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  tabButtonActive: {
    transform: [{ scale: 1.02 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: "#409CFF",
    fontWeight: "600",
  },
  tabLabelInactive: {
    color: "#86868B",
  },
});
