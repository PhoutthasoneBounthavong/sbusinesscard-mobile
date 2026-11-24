import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Share,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchMyDigitalCard,
  saveMyDigitalCard,
  fetchDigitalCardQr,
  getLocalDigitalCardSync,
  API_BASE,
} from "../api";
import { useAlert } from "../context/AlertContext";

const CARD_THEMES = [
  {
    id: "apple_dark",
    label: "Apple Dark",
    bg: "#1C1C1E",
    border: "rgba(255,255,255,0.14)",
    accent: "#0071E3",
    accentLight: "#409CFF",
  },
  {
    id: "midnight_blue",
    label: "Midnight Blue",
    bg: "#0B192C",
    border: "rgba(64,156,255,0.3)",
    accent: "#0A84FF",
    accentLight: "#64D2FF",
  },
  {
    id: "obsidian_gold",
    label: "Obsidian Gold",
    bg: "#1A1610",
    border: "rgba(255,214,10,0.3)",
    accent: "#D4AF37",
    accentLight: "#FFD60A",
  },
  {
    id: "emerald_pro",
    label: "Emerald Pro",
    bg: "#0D1F17",
    border: "rgba(48,209,88,0.3)",
    accent: "#28CD41",
    accentLight: "#30D158",
  },
];

const DEFAULT_CARD = {
  full_name: "Businesscard",
  job_title: "Chief Executive Officer & Founder",
  company: "SBusinessCard Technologies",
  badge_text: "Staff",
  headline: "Designing next-generation spatial computing & AI systems.",
  bio: "Building elegant software at the intersection of design, engineering, and human experience.",
  theme: "apple_dark",
  phone: "+1 (555) 234-5678",
  email: "Demo@sbusinesscard.app",
  website: "https://sbusinesscard.app",
  address: "1 Infinite Loop, Cupertino, CA",
  slug: "Demo-B",
};

export default function MyDigitalCardScreen({ insets }) {
  const { showAlert } = useAlert();
  const [mode, setMode] = useState("preview"); // 'preview' | 'studio'
  const [card, setCard] = useState(() => getLocalDigitalCardSync() || DEFAULT_CARD);
  const [saving, setSaving] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const loadQr = async (slugToUse) => {
    setLoadingQr(true);
    try {
      const data = await fetchDigitalCardQr(slugToUse);
      if (data) setQrData(data);
    } catch (e) { }
    setLoadingQr(false);
  };

  useEffect(() => {
    fetchMyDigitalCard()
      .then((res) => {
        if (res.card) {
          setCard((prev) => ({ ...prev, ...res.card }));
          loadQr(res.card.slug);
        } else {
          loadQr(card.slug);
        }
      })
      .catch(() => {
        loadQr(card.slug);
      });
  }, []);

  const activeTheme =
    CARD_THEMES.find((t) => t.id === card.theme) || CARD_THEMES[0];

  const buildDirectVcard = (c) => {
    const fullName = (c.full_name || "Contact").trim();
    const nameParts = fullName.split(/\s+/);
    const givenName = nameParts[0] || "";
    const familyName = nameParts.slice(1).join(" ") || "";
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${fullName}`,
      `N:${familyName};${givenName};;;`,
    ];
    if (c.company) lines.push(`ORG:${c.company.trim()}`);
    if (c.job_title) lines.push(`TITLE:${c.job_title.trim()}`);
    if (c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${c.phone.trim()}`);
    if (c.email) lines.push(`EMAIL;TYPE=WORK,INTERNET:${c.email.trim()}`);
    if (c.website) lines.push(`URL:${c.website.trim()}`);
    if (c.address) lines.push(`ADR;TYPE=WORK:;;${c.address.trim()};;;;`);
    lines.push("END:VCARD");
    return lines.join("\r\n");
  };

  // Always use the live card fields to ensure QR code reflects any edits made in Card Studio
  const vcardText = buildDirectVcard(card);
  const activeQrUri =
    qrData && qrData.vcard && qrData.vcard.trim() === vcardText.trim()
      ? qrData.qr_data_uri
      : `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(vcardText)}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Contact: ${card.full_name || 'Contact'} (${card.job_title || ''} at ${card.company || ''})\nPhone: ${card.phone || ''}\nEmail: ${card.email || ''}`,
        title: `${card.full_name || 'My'}'s Contact Card`,
      });
    } catch (error) {
      showAlert({
        title: "Share Error",
        message: error.message || "Failed to share card",
        type: "error",
      });
    }
  };

  const handleSaveStudio = async () => {
    if (!card.full_name || !card.full_name.trim()) {
      showAlert({
        title: "Name Required",
        message: "Please enter your full name for your digital card.",
        type: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await saveMyDigitalCard(card);
      const savedCard = res.card ? { ...card, ...res.card } : card;
      setCard(savedCard);
      // Immediately refresh the QR code with latest saved contact details
      await loadQr(savedCard.slug);
      setMode("preview");
      showAlert({
        title: "Digital Card Saved",
        message: res.cloudSynced
          ? "Your digital business card and QR code have been updated and synced!"
          : "Your digital business card and QR code have been updated!",
        type: "success",
      });
    } catch (err) {
      showAlert({
        title: "Save Notice",
        message: err.message || "Saved locally on device.",
        type: "info",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 120 + (insets?.bottom || 0) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Header + Mode Switcher */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {mode === "studio" ? "Card Studio" : "My Digital Card"}
            </Text>
            <Text style={styles.headerSubtitle}>
              {mode === "studio"
                ? "Customize your personal shareable business card"
                : "Tap or share your QR card to connect instantly"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.studioToggleBtn,
              mode === "studio" && styles.studioToggleBtnActive,
            ]}
            onPress={() => setMode(mode === "preview" ? "studio" : "preview")}
            activeOpacity={0.8}
          >
            <Ionicons
              name={mode === "preview" ? "color-wand-outline" : "eye-outline"}
              size={15}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.studioToggleBtnText}>
              {mode === "preview" ? "Card Studio" : "Preview"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Apple Wallet Style Digital Card Preview (Always Visible!) */}
        <View
          style={[
            styles.digitalCard,
            {
              backgroundColor: activeTheme.bg,
              borderColor: activeTheme.border,
            },
          ]}
        >
          <View style={styles.cardTopBar}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: `${activeTheme.accent}33`,
                  borderColor: `${activeTheme.accent}66`,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: activeTheme.accentLight }]}>
                {(card.badge_text || "STAFF").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.nfcText}>NFC / QR ACTIVE</Text>
          </View>

          <View style={styles.profileSection}>
            <View
              style={[styles.avatar, { backgroundColor: activeTheme.accent }]}
            >
              <Text style={styles.avatarText}>
                {(card.full_name || "S")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.fullName}>{card.full_name || "Your Name"}</Text>
              <Text style={styles.jobTitle}>{card.job_title || "Your Role"}</Text>
              <Text style={[styles.company, { color: activeTheme.accentLight }]}>
                {card.company || "Your Company"}
              </Text>
            </View>
          </View>

          {card.headline ? (
            <Text style={styles.headline}>"{card.headline}"</Text>
          ) : null}

          <View style={styles.contactDetails}>
            {card.phone ? (
              <View style={styles.contactRow}>
                <Ionicons
                  name="call-outline"
                  size={15}
                  color={activeTheme.accentLight}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.contactItem}>{card.phone}</Text>
              </View>
            ) : null}
            {card.email ? (
              <View style={styles.contactRow}>
                <Ionicons
                  name="mail-outline"
                  size={15}
                  color={activeTheme.accentLight}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.contactItem}>{card.email}</Text>
              </View>
            ) : null}
            {card.website ? (
              <View style={styles.contactRow}>
                <Ionicons
                  name="globe-outline"
                  size={15}
                  color={activeTheme.accentLight}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.contactItem}>{card.website}</Text>
              </View>
            ) : null}
            {card.address ? (
              <View style={styles.contactRow}>
                <Ionicons
                  name="location-outline"
                  size={15}
                  color={activeTheme.accentLight}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.contactItem}>{card.address}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {mode === "studio" ? (
          /* ============================================================
             CLIENT CARD STUDIO EDITOR (Customize Theme & Contact Fields)
             ============================================================ */
          <View style={styles.studioFormCard}>
            <Text style={styles.studioSectionLabel}>1. CHOOSE CARD THEME</Text>
            <View style={styles.themeRow}>
              {CARD_THEMES.map((t) => {
                const isSelected = (card.theme || "apple_dark") === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.themeChip,
                      { backgroundColor: t.bg, borderColor: t.border },
                      isSelected && {
                        borderColor: t.accentLight,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setCard({ ...card, theme: t.id })}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.themeDot,
                        { backgroundColor: t.accentLight },
                      ]}
                    />
                    <Text style={styles.themeChipText}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.studioSectionLabel, { marginTop: 18 }]}>
              2. IDENTITY & ROLE
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.full_name}
                onChangeText={(v) => setCard({ ...card, full_name: v })}
                placeholder="e.g. Business Card"
                placeholderTextColor="#636366"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Job Title / Position</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.job_title}
                onChangeText={(v) => setCard({ ...card, job_title: v })}
                placeholder="e.g. Chief Executive Officer"
                placeholderTextColor="#636366"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Company / Organization</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.company}
                onChangeText={(v) => setCard({ ...card, company: v })}
                placeholder="e.g. SBusinessCard Inc."
                placeholderTextColor="#636366"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Top Badge Label</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.badge_text}
                onChangeText={(v) => setCard({ ...card, badge_text: v })}
                placeholder="e.g. STAFF"
                placeholderTextColor="#636366"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Headline / Tagline</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.headline}
                onChangeText={(v) => setCard({ ...card, headline: v })}
                placeholder="Short tagline or mission..."
                placeholderTextColor="#636366"
              />
            </View>

            <Text style={[styles.studioSectionLabel, { marginTop: 14 }]}>
              3. CONTACT CHANNELS
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.phone}
                onChangeText={(v) => setCard({ ...card, phone: v })}
                keyboardType="phone-pad"
                placeholder="+66 81 234 5678"
                placeholderTextColor="#636366"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.email}
                onChangeText={(v) => setCard({ ...card, email: v })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@sbusinesscard.app"
                placeholderTextColor="#636366"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Website URL</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.website}
                onChangeText={(v) => setCard({ ...card, website: v })}
                autoCapitalize="none"
                placeholder="https://sbusinesscard.app"
                placeholderTextColor="#636366"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Office / Location Address</Text>
              <TextInput
                style={styles.fieldInput}
                value={card.address}
                onChangeText={(v) => setCard({ ...card, address: v })}
                placeholder="City, Country"
                placeholderTextColor="#636366"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.saveStudioButton,
                { backgroundColor: activeTheme.accent },
              ]}
              onPress={handleSaveStudio}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.saveStudioButtonText}>
                {saving ? "Saving Card..." : "Save My Digital Card"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ============================================================
             PREVIEW & INSTANT QR SHARING MODE
             ============================================================ */
          <View style={styles.qrContainer}>
            <Text style={styles.qrTitle}>My Contact QR</Text>
            <Text style={styles.qrSubtitle}>
              Scan with iPhone or Android camera to instantly add my contact to your phone address book.
            </Text>

            {/* Live Scannable Apple-grade QR Code */}
            <View style={styles.qrWhiteBox}>
              {loadingQr ? (
                <View style={styles.qrLoadingBox}>
                  <ActivityIndicator size="small" color="#0071E3" />
                  <Text style={styles.qrLoadingText}>Generating QR...</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: activeQrUri }}
                  style={styles.qrImageReal}
                  resizeMode="contain"
                />
              )}
              <View style={styles.qrBadgeRow}>
                <View style={styles.qrGreenDot} />
                <Text style={styles.qrBadgeText}>
                  Instant Contact Card (Apple & Android)
                </Text>
              </View>
            </View>

            {/* Direct Contact Card Summary Chip
            <View style={styles.contactDetailsPill}>
              <View style={styles.contactDetailsRow}>
                <Ionicons name="person" size={13} color="#409CFF" style={{ marginRight: 6 }} />
                <Text style={styles.contactDetailsText} numberOfLines={1}>
                  {card.full_name || "Contact Name"}
                </Text>
              </View>
              {!!card.phone && (
                <View style={styles.contactDetailsRow}>
                  <Ionicons name="call" size={13} color="#34C759" style={{ marginRight: 6 }} />
                  <Text style={styles.contactDetailsText} numberOfLines={1}>
                    {card.phone}
                  </Text>
                </View>
              )}
              {!!card.company && (
                <View style={styles.contactDetailsRow}>
                  <Ionicons name="business" size={13} color="#FF9F0A" style={{ marginRight: 6 }} />
                  <Text style={styles.contactDetailsText} numberOfLines={1}>
                    {card.company}
                  </Text>
                </View>
              )}
            </View> */}

            <TouchableOpacity
              style={[
                styles.shareButton,
                { backgroundColor: activeTheme.accent },
              ]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Ionicons
                name="share-outline"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.shareButtonText}>
                Share Contact Card (AirDrop / WhatsApp / SMS)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryEditBtn}
              onPress={() => setMode("studio")}
              activeOpacity={0.75}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color="#409CFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.secondaryEditBtnText}>
                Edit Contact Details in Card Studio
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 12,
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
  studioToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0071E3",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  studioToggleBtnActive: {
    backgroundColor: "#2C2C2E",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  studioToggleBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "600",
  },
  digitalCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
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
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,113,227,0.3)",
  },
  badgeText: {
    color: "#409CFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  nfcText: {
    color: "#86868B",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#0071E3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
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
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  jobTitle: {
    color: "#86868B",
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
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: 16,
  },
  contactDetails: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 14,
    gap: 10,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactItem: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  studioFormCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  studioSectionLabel: {
    color: "#86868B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  themeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  themeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  themeChipText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "600",
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: "#AEAEB2",
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 5,
  },
  fieldInput: {
    backgroundColor: "#2C2C2E",
    color: "#FFFFFF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  saveStudioButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0071E3",
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  saveStudioButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
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
    marginBottom: 4,
  },
  qrSubtitle: {
    color: "#86868B",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  qrModeSelector: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  qrModeTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  qrModeTabActive: {
    backgroundColor: "#0071E3",
  },
  qrModeTabText: {
    color: "#86868B",
    fontSize: 12,
    fontWeight: "600",
  },
  qrModeTabTextActive: {
    color: "#FFFFFF",
  },
  qrWhiteBox: {
    width: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  qrImageReal: {
    width: 180,
    height: 180,
    borderRadius: 12,
  },
  qrLoadingBox: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  qrLoadingText: {
    marginTop: 8,
    fontSize: 11,
    color: "#86868B",
    fontWeight: "500",
  },
  qrBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#F2F2F7",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  qrGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34C759",
    marginRight: 6,
  },
  qrBadgeText: {
    fontSize: 9,
    color: "#1D1D1F",
    fontWeight: "600",
  },
  contactDetailsPill: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: "100%",
    marginBottom: 16,
    gap: 4,
  },
  contactDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactDetailsText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
  },
  urlDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: "100%",
    marginBottom: 16,
  },
  urlDisplayText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  openUrlBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  openUrlBtnText: {
    color: "#409CFF",
    fontSize: 11,
    fontWeight: "700",
  },
  slugHintText: {
    color: "#86868B",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  shareButton: {
    flexDirection: "row",
    justifyContent: "center",
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
  secondaryEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 6,
  },
  secondaryEditBtnText: {
    color: "#409CFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
