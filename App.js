import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import ScannerScreen from "./src/screens/ScannerScreen";
import CardsVaultScreen from "./src/screens/CardsVaultScreen";
import MyDigitalCardScreen from "./src/screens/MyDigitalCardScreen";

export default function App() {
  const [currentTab, setCurrentTab] = useState("scan"); // 'scan' | 'vault' | 'card'

  const tabs = [
    { id: "scan", label: "Scan Card", icon: "📷" },
    { id: "vault", label: "Cards Vault", icon: "📇" },
    { id: "card", label: "My Card", icon: "🪪" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Screen Views */}
      <View style={styles.screenContainer}>
        {currentTab === "scan" && (
          <ScannerScreen onNavigateToVault={() => setCurrentTab("vault")} />
        )}
        {currentTab === "vault" && <CardsVaultScreen />}
        {currentTab === "card" && <MyDigitalCardScreen />}
      </View>

      {/* Apple-styled Bottom Tab Bar with Frosted Dark Aesthetic */}
      <SafeAreaView style={styles.tabBarWrapper}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setCurrentTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                activeOpacity={0.7}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  screenContainer: {
    flex: 1,
  },
  tabBarWrapper: {
    backgroundColor: "#121214",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  tabBar: {
    flexDirection: "row",
    height: 56,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  tabButtonActive: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: "#409CFF",
  },
  tabLabelInactive: {
    color: "#86868B",
  },
});
