import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Share,
  Alert,
} from "react-native";
import { fetchMyDigitalCard, API_BASE } from "../api";

export default function MyDigitalCardScreen() {
  const [card, setCard] = useState({
    full_name: "Alex Morgan",
    job_title: "Chief Executive Officer & Founder",
    company: "Aura Technologies Inc.",
    headline: "Designing next-generation spatial computing & AI systems.",
    phone: "+1 (555) 234-5678",
    email: "alex.morgan@auratech.io",
    website: "https://auratech.io",
    slug: "alex-morgan",
  });

  useEffect(() => {
    fetchMyDigitalCard()
      .then((res) => {
        if (res.card) setCard(res.card);
      })
      .catch(() => {});
  }, []);

  const publicUrl = `http://localhost:5173/c/${card.slug || "alex-morgan"}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Connect with ${card.full_name} (${card.job_title} at ${card.company}): ${publicUrl}`,
        url: publicUrl,
        title: `${card.full_name}'s Business Card`,
      });
    } catch (error) {
      Alert.alert("Share Error", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Digital Card</Text>
          <Text style={styles.headerSubtitle}>Tap or share to connect instantly</Text>
        </View>

        {/* Apple Wallet Style Digital Card */}
        <View style={styles.digitalCard}>
          <View style={styles.cardTopBar}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>VIP FOUNDER</Text>
            </View>
            <Text style={styles.nfcText}>NFC / QR ACTIVE</Text>
          </View>

          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {card.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.fullName}>{card.full_name}</Text>
              <Text style={styles.jobTitle}>{card.job_title}</Text>
              <Text style={styles.company}>{card.company}</Text>
            </View>
          </View>

          {card.headline ? (
            <Text style={styles.headline}>"{card.headline}"</Text>
          ) : null}

          <View style={styles.contactDetails}>
            <Text style={styles.contactItem}>📞 {card.phone}</Text>
            <Text style={styles.contactItem}>✉️ {card.email}</Text>
            <Text style={styles.contactItem}>🌐 {card.website}</Text>
          </View>
        </View>

        {/* QR Code Sharing Box */}
        <View style={styles.qrContainer}>
          <Text style={styles.qrTitle}>Conference QR Code</Text>
          <Text style={styles.qrSubtitle}>Others can scan this with their phone camera to save your card</Text>

          <View style={styles.qrPlaceholder}>
            {/* Visual simulation of high-density QR code */}
            <View style={styles.qrGrid}>
              <View style={[styles.qrBlock, styles.qrCornerTL]} />
              <View style={[styles.qrBlock, styles.qrCornerTR]} />
              <View style={[styles.qrBlock, styles.qrCornerBL]} />
              <Text style={styles.qrCenterText}>SCAN ME</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share Digital Card Link (AirDrop / SMS)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: "#86868B",
    fontSize: 12,
    marginTop: 2,
  },
  digitalCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  cardTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  badge: {
    backgroundColor: "rgba(0,113,227,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,113,227,0.4)",
  },
  badgeText: {
    color: "#409CFF",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  nfcText: {
    color: "#86868B",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#0071E3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  fullName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  jobTitle: {
    color: "#AEAEB2",
    fontSize: 12,
    marginTop: 2,
  },
  company: {
    color: "#409CFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  headline: {
    color: "#86868B",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    borderRadius: 12,
  },
  contactDetails: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
  },
  contactItem: {
    color: "#AEAEB2",
    fontSize: 11,
    fontWeight: "500",
  },
  qrContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  qrTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  qrSubtitle: {
    color: "#86868B",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  qrGrid: {
    width: "100%",
    height: "100%",
    borderWidth: 2,
    borderColor: "#000000",
    borderRadius: 12,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  qrBlock: {
    position: "absolute",
    width: 32,
    height: 32,
    backgroundColor: "#000000",
    borderRadius: 4,
  },
  qrCornerTL: { top: 6, left: 6 },
  qrCornerTR: { top: 6, right: 6 },
  qrCornerBL: { bottom: 6, left: 6 },
  qrCenterText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  shareButton: {
    backgroundColor: "#0071E3",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  shareButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
