import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getLocalVaultCards,
  getLocalVaultCardsSync,
  syncVaultWithCloud,
  updateCardInVault,
  deleteCardFromVault,
} from "../api";
import { saveToNativeContacts } from "../services/contactSaver";
import { useAlert } from "../context/AlertContext";

export default function CardsVaultScreen({ insets, onNavigateToScan }) {
  const { showAlert } = useAlert();
  // Instant 0ms initialization from in-memory local vault cache
  const [allCards, setAllCards] = useState(() => getLocalVaultCardsSync() || []);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [cloudStatus, setCloudStatus] = useState({
    cloudOnline: true,
    pendingCount: 0,
    lastBackupAt: null,
  });

  // Edit modal state
  const [editingCard, setEditingCard] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    job_title: "",
    company: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Instant 0ms local search filtering (zero network wait per keystroke!)
  const cards = useMemo(() => {
    if (!search || !search.trim()) return allCards;
    const q = search.trim().toLowerCase();
    return allCards.filter(
      (c) =>
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.job_title || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }, [allCards, search]);

  // 1. Load instantly from phone's Local Vault, then silently sync with Online Cloud DB
  const loadCards = async (isPullRefresh = false) => {
    if (isPullRefresh) setLoading(true);
    try {
      const local = await getLocalVaultCards();
      if (local && local.length > 0) {
        setAllCards(local);
      }
    } catch (e) { }

    // Run non-blocking background Cloud Backup & Sync
    setSyncingCloud(true);
    try {
      const syncRes = await syncVaultWithCloud();
      if (syncRes && Array.isArray(syncRes.cards)) {
        // Safe UI state update: never wipe local cards if sync returned empty
        if (syncRes.cards.length > 0) {
          setAllCards(syncRes.cards);
        } else {
          const currentLocal = await getLocalVaultCards();
          if (!currentLocal || currentLocal.length === 0) {
            setAllCards([]);
          }
        }
        setCloudStatus({
          cloudOnline: syncRes.cloudOnline,
          pendingCount: syncRes.pendingCount || 0,
          lastBackupAt: syncRes.lastBackupAt,
        });
      }
    } catch (err) {
      // Keep local vault cards intact
    } finally {
      setSyncingCloud(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards(false);
  }, []);

  // Parse multiple phone numbers from a business card string (e.g. "081-111-1111 / 089-222-2222")
  const parseMultiplePhones = (phoneString) => {
    if (!phoneString) return [];
    const rawParts = phoneString.split(/[,/|;\n&]|\bor\b|\s{2,}/i);
    const phones = [];
    for (let part of rawParts) {
      const trimmed = part.trim();
      const digits = trimmed.replace(/[^\d]/g, "");
      if (digits.length >= 7) {
        phones.push(trimmed);
      }
    }
    if (phones.length === 0 && phoneString.trim()) {
      return [phoneString.trim()];
    }
    return phones;
  };

  // Direct launcher for a single confirmed phone number
  const openDirectWhatsApp = (singlePhone) => {
    if (!singlePhone) return;
    let cleanNumber = singlePhone.replace(/[^\d]/g, "");

    // Handle local numbers (e.g. Thailand 08x, 09x, 06x)
    if (cleanNumber.startsWith("0") && (cleanNumber.length === 9 || cleanNumber.length === 10)) {
      cleanNumber = "66" + cleanNumber.slice(1);
    }

    if (!cleanNumber || cleanNumber.length < 5) {
      showAlert({
        title: "Invalid Phone Number",
        message: "The phone number could not be recognized for WhatsApp.",
        type: "warning",
      });
      return;
    }

    const appUrl = `whatsapp://send?phone=${cleanNumber}`;
    const webUrl = `https://wa.me/${cleanNumber}`;

    Linking.canOpenURL(appUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(appUrl);
        } else {
          return Linking.openURL(webUrl);
        }
      })
      .catch(() => {
        Linking.openURL(webUrl).catch(() => {
          showAlert({
            title: "WhatsApp Unavailable",
            message: "Could not open WhatsApp. Please ensure WhatsApp is installed on your device.",
            type: "warning",
          });
        });
      });
  };

  // Smart WhatsApp button handler: if 1 number, opens immediately; if 2+ numbers, asks user to choose Number 1 or Number 2!
  const handleWhatsApp = (phoneString, contactName = "") => {
    if (!phoneString) {
      showAlert({
        title: "No Phone Number",
        message: "This contact does not have a phone number saved.",
        type: "warning",
      });
      return;
    }

    const phoneList = parseMultiplePhones(phoneString);

    if (phoneList.length <= 1) {
      openDirectWhatsApp(phoneList[0] || phoneString);
      return;
    }

    // Contact has 2 or more phone numbers: ask user to choose which number goes to WhatsApp
    const buttons = phoneList.map((p, index) => ({
      text: `${p}`,
      onPress: () => openDirectWhatsApp(p),
    }));

    buttons.push({ text: "Cancel", style: "cancel" });

    showAlert({
      title: "Choose WhatsApp Number",
      message: `"${contactName || "Contact"}" has ${phoneList.length} phone numbers. Which number would you like to message on WhatsApp?`,
      type: "info",
      buttons: buttons,
    });
  };

  // Smart Call handler: if 1 number, calls directly; if 2+ numbers, asks user to choose Number 1 or Number 2!
  const handleCall = (phoneString, contactName = "") => {
    if (!phoneString) return;
    const phoneList = parseMultiplePhones(phoneString);

    if (phoneList.length <= 1) {
      Linking.openURL(`tel:${phoneList[0] || phoneString}`);
      return;
    }

    const buttons = phoneList.map((p, index) => ({
      text: `📞 Call Number ${index + 1}: ${p}`,
      onPress: () => Linking.openURL(`tel:${p}`),
    }));

    buttons.push({ text: "Cancel", style: "cancel" });

    showAlert({
      title: "Choose Phone to Call",
      message: `"${contactName || "Contact"}" has ${phoneList.length} phone numbers. Which number would you like to call?`,
      type: "info",
      buttons: buttons,
    });
  };

  const handleEmail = (email) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  const handleOpenUrl = (url) => {
    if (!url) return;
    const target = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(target);
  };

  // Delete Card with Confirmation (Instant Local Vault Remove + Background Cloud Sync)
  const handleDeleteCard = (card) => {
    showAlert({
      title: "Delete Contact",
      message: `Are you sure you want to delete "${card.full_name || "this card"}" from your Cards Vault? This action cannot be undone.`,
      type: "destructive",
      buttons: [
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(card.id);
            try {
              await deleteCardFromVault(card.id);
              setAllCards((prev) => prev.filter((c) => c.id !== card.id));
              showAlert({
                title: "Contact Removed",
                message: "Contact has been removed from your Local & Cloud Vault.",
                type: "success",
              });
            } catch (err) {
              setAllCards((prev) => prev.filter((c) => c.id !== card.id));
              showAlert({
                title: "Contact Removed",
                message: "Contact removed from list.",
                type: "success",
              });
            } finally {
              setDeletingId(null);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    });
  };

  // Open Edit Modal
  const handleStartEdit = (card) => {
    setEditingCard(card);
    setEditForm({
      full_name: card.full_name || "",
      job_title: card.job_title || "",
      company: card.company || "",
      phone: card.phone || "",
      email: card.email || "",
      website: card.website || "",
      address: card.address || "",
      notes: card.notes || "",
    });
  };

  // Save Edits (Instant Local Vault Update + Background Cloud Backup)
  const handleSaveEdit = async () => {
    if (!editForm.full_name.trim()) {
      showAlert({
        title: "Name Required",
        message: "Please enter at least a full name for this contact.",
        type: "warning",
      });
      return;
    }

    setSavingEdit(true);
    try {
      await updateCardInVault(editingCard.id, editForm);
      setAllCards((prev) =>
        prev.map((c) => (c.id === editingCard.id ? { ...c, ...editForm } : c))
      );
      setEditingCard(null);
      showAlert({
        title: "Contact Updated",
        message: `"${editForm.full_name}" saved locally & backing up to cloud.`,
        type: "success",
      });
    } catch (err) {
      setAllCards((prev) =>
        prev.map((c) => (c.id === editingCard.id ? { ...c, ...editForm } : c))
      );
      setEditingCard(null);
      showAlert({
        title: "Contact Updated",
        message: `"${editForm.full_name}" details updated in Local Vault.`,
        type: "success",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => handleStartEdit(item)}
      activeOpacity={0.85}
    >
      {/* Top Header Row with Name and Edit/Delete Actions */}
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.full_name || "C")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.full_name || "Contact"}</Text>
          {item.job_title ? (
            <Text style={styles.cardTitle}>{item.job_title}</Text>
          ) : null}
          {item.company ? (
            <Text style={styles.cardCompany}>{item.company}</Text>
          ) : null}
        </View>

        {/* Action Buttons: Edit and Delete */}
        <View style={styles.cardTopActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleStartEdit(item)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={16} color="#0071E3" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, styles.iconButtonDelete]}
            onPress={() => handleDeleteCard(item)}
            activeOpacity={0.7}
            disabled={deletingId === item.id}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {deletingId === item.id ? (
              <ActivityIndicator size="small" color="#FF453A" />
            ) : (
              <Ionicons name="trash-outline" size={16} color="#FF453A" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact Details Body */}
      <View style={styles.cardDetails}>
        {item.phone ? (
          (() => {
            const phoneList = parseMultiplePhones(item.phone);
            return phoneList.map((p, idx) => (
              <View key={idx} style={styles.detailRowWithAction}>
                <TouchableOpacity
                  style={styles.detailRowFlex}
                  onPress={() => handleCall(p, item.full_name)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={14} color="#86868B" style={styles.detailIcon} />
                  <Text style={styles.detailText}>
                    {phoneList.length > 1 ? `(#${idx + 1}) ` : ""}{p}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailWhatsAppPill}
                  onPress={() => openDirectWhatsApp(p)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="logo-whatsapp" size={13} color="#25D366" style={{ marginRight: 4 }} />
                  <Text style={styles.detailWhatsAppPillText}>
                    {phoneList.length > 1 ? `WA #${idx + 1}` : "WhatsApp"}
                  </Text>
                </TouchableOpacity>
              </View>
            ));
          })()
        ) : null}

        {item.email ? (
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => handleEmail(item.email)}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={14} color="#86868B" style={styles.detailIcon} />
            <Text style={styles.detailText}>{item.email}</Text>
          </TouchableOpacity>
        ) : null}

        {item.website ? (
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => handleOpenUrl(item.website)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={14} color="#86868B" style={styles.detailIcon} />
            <Text style={[styles.detailText, styles.detailLink]}>{item.website}</Text>
          </TouchableOpacity>
        ) : null}

        {item.address ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color="#86868B" style={styles.detailIcon} />
            <Text style={styles.detailText} numberOfLines={2}>
              {item.address}
            </Text>
          </View>
        ) : null}

        {item.notes ? (
          <View style={styles.notesRow}>
            <Text style={styles.notesText}>Note: {item.notes}</Text>
          </View>
        ) : null}
      </View>

      {/* Quick Action Chips Footer */}
      <View style={styles.actionsRow}>
        {item.phone ? (
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => handleCall(item.phone, item.full_name)}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.actionChipText}>Call</Text>
          </TouchableOpacity>
        ) : null}

        {/*{item.phone ? (
          <TouchableOpacity
            style={[styles.actionChip, styles.actionChipWhatsApp]}
            onPress={() => handleWhatsApp(item.phone, item.full_name)}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-whatsapp" size={13} color="#25D366" style={{ marginRight: 4 }} />
            <Text style={styles.actionChipWhatsAppText}>WhatsApp</Text>
          </TouchableOpacity>
        ) : null} */}

        {item.email ? (
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => handleEmail(item.email)}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.actionChipText}>Email</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.actionChip, styles.actionChipPrimary]}
          onPress={() => saveToNativeContacts(item, showAlert)}
          activeOpacity={0.7}
        >
          <Ionicons name="person-add-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.actionChipPrimaryText}>Add to Phone</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Cards Vault</Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.headerSubtitle}>
              {cards.length} Digitized Contact{cards.length === 1 ? "" : "s"}
            </Text>
            <TouchableOpacity
              style={[
                styles.cloudSyncBadge,
                syncingCloud
                  ? styles.cloudSyncBadgeActive
                  : cloudStatus.pendingCount > 0 || !cloudStatus.cloudOnline
                    ? styles.cloudSyncBadgePending
                    : styles.cloudSyncBadgeOk,
              ]}
              onPress={() => loadCards(false)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={
                  syncingCloud
                    ? "sync-outline"
                    : cloudStatus.pendingCount > 0 || !cloudStatus.cloudOnline
                      ? "phone-portrait-outline"
                      : "cloud-done-outline"
                }
                size={11}
                color={
                  syncingCloud
                    ? "#409CFF"
                    : cloudStatus.pendingCount > 0 || !cloudStatus.cloudOnline
                      ? "#FFD60A"
                      : "#30D158"
                }
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.cloudSyncBadgeText,
                  syncingCloud
                    ? { color: "#409CFF" }
                    : cloudStatus.pendingCount > 0 || !cloudStatus.cloudOnline
                      ? { color: "#FFD60A" }
                      : { color: "#30D158" },
                ]}
              >
                {syncingCloud
                  ? "Syncing Cloud..."
                  : cloudStatus.pendingCount > 0
                    ? `Local Vault (${cloudStatus.pendingCount} pending) • Tap to Backup`
                    : !cloudStatus.cloudOnline
                      ? "Local Vault (Offline) • Tap to Sync"
                      : "Local + Cloud Backed Up"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {onNavigateToScan && (
          <TouchableOpacity
            style={styles.headerScanBtn}
            onPress={onNavigateToScan}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.headerScanBtnText}>Scan Card</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#86868B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, company, email..."
            placeholderTextColor="#86868B"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#86868B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Cards List or Empty State */}
      <FlatList
        data={cards}
        keyExtractor={(item, index) => (item?.id != null ? String(item.id) : String(index))}
        renderItem={renderCard}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 110 + (insets?.bottom || 0) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={() => loadCards(true)}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={54} color="#3A3A3C" />
              <Text style={styles.emptyTitle}>No Cards in Vault</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? "No contacts matched your search query."
                  : "Scan a business card to store, edit, and access it here anytime."}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Apple HIG Inset Grouped Bottom-Sheet Modal */}
      <Modal
        visible={!!editingCard}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingCard(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={() => setEditingCard(null)}>
            <View style={styles.modalDismissArea} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.bottomSheet}
          >
            {/* Grabber Handle */}
            <View style={styles.grabberContainer}>
              <View style={styles.grabberPill} />
            </View>

            {/* Navigation Header */}
            <View style={styles.sheetHeader}>
              <TouchableOpacity
                onPress={() => setEditingCard(null)}
                style={styles.sheetCancelBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>

              <Text style={styles.sheetTitle}>Edit Contact</Text>

              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={savingEdit}
                style={styles.sheetSaveBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sheetSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              style={styles.sheetBody}
              contentContainerStyle={styles.sheetBodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Contact Hero Avatar & Live Name */}
              <View style={styles.heroSection}>
                <View style={styles.heroAvatar}>
                  <Text style={styles.heroAvatarText}>
                    {(editForm.full_name || "C")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.heroName} numberOfLines={1}>
                  {editForm.full_name || "New Contact"}
                </Text>
                <Text style={styles.heroRole} numberOfLines={1}>
                  {[editForm.job_title, editForm.company]
                    .filter(Boolean)
                    .join(" • ") || "Digital Business Card"}
                </Text>
              </View>

              {/* Group 1: Identity & Professional Role */}
              <Text style={styles.sectionHeader}>IDENTITY</Text>
              <View style={styles.groupedCard}>
                {/* Full Name */}
                <View style={styles.inputRow}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(0,113,227,0.15)" }]}>
                    <Ionicons name="person" size={14} color="#0071E3" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>FULL NAME</Text>
                    <TextInput
                      style={styles.insetTextInput}
                      placeholder="Full Name"
                      placeholderTextColor="#636366"
                      value={editForm.full_name}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, full_name: text }))
                      }
                    />
                  </View>
                </View>

                <View style={styles.rowDivider} />

                {/* Job Title */}
                <View style={styles.inputRow}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(0,113,227,0.15)" }]}>
                    <Ionicons name="briefcase" size={14} color="#0071E3" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>JOB TITLE</Text>
                    <TextInput
                      style={styles.insetTextInput}
                      placeholder="e.g. Chief Executive Officer"
                      placeholderTextColor="#636366"
                      value={editForm.job_title}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, job_title: text }))
                      }
                    />
                  </View>
                </View>

                <View style={styles.rowDivider} />

                {/* Company */}
                <View style={styles.inputRow}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(0,113,227,0.15)" }]}>
                    <Ionicons name="business" size={14} color="#0071E3" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>COMPANY</Text>
                    <TextInput
                      style={styles.insetTextInput}
                      placeholder="e.g. SBusinessCard Inc."
                      placeholderTextColor="#636366"
                      value={editForm.company}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, company: text }))
                      }
                    />
                  </View>
                </View>
              </View>

              {/* Group 2: Contact Communication */}
              <Text style={styles.sectionHeader}>CONTACT DETAILS</Text>
              <View style={styles.groupedCard}>
                {/* Phone Number */}
                <View style={styles.inputRow}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(52,199,89,0.18)" }]}>
                    <Ionicons name="call" size={14} color="#34C759" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>PHONE NUMBER</Text>
                    <TextInput
                      style={styles.insetTextInput}
                      placeholder="+1 (555) 000-0000"
                      placeholderTextColor="#636366"
                      keyboardType="phone-pad"
                      value={editForm.phone}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, phone: text }))
                      }
                    />
                  </View>
                  {editForm.phone ? (
                    <TouchableOpacity
                      style={styles.modalWhatsAppBtn}
                      onPress={() => handleWhatsApp(editForm.phone, editForm.full_name)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.rowDivider} />

                {/* Email Address */}
                <View style={styles.inputRow}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(10,132,255,0.18)" }]}>
                    <Ionicons name="mail" size={14} color="#0A84FF" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>EMAIL ADDRESS</Text>
                    <TextInput
                      style={styles.insetTextInput}
                      placeholder="email@example.com"
                      placeholderTextColor="#636366"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={editForm.email}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, email: text }))
                      }
                    />
                  </View>
                </View>

                <View style={styles.rowDivider} />

                {/* Website */}
                <View style={styles.inputRow}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(191,90,242,0.18)" }]}>
                    <Ionicons name="globe" size={14} color="#BF5AF2" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>WEBSITE</Text>
                    <TextInput
                      style={styles.insetTextInput}
                      placeholder="https://example.com"
                      placeholderTextColor="#636366"
                      keyboardType="url"
                      autoCapitalize="none"
                      value={editForm.website}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, website: text }))
                      }
                    />
                  </View>
                </View>
              </View>

              {/* Group 3: Location & Additional Notes */}
              <Text style={styles.sectionHeader}>LOCATION & NOTES</Text>
              <View style={styles.groupedCard}>
                {/* Physical Address */}
                <View style={styles.inputRow}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(255,149,0,0.18)" }]}>
                    <Ionicons name="location" size={14} color="#FF9500" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>PHYSICAL ADDRESS</Text>
                    <TextInput
                      style={styles.insetTextInput}
                      placeholder="123 Main St, City, Country"
                      placeholderTextColor="#636366"
                      value={editForm.address}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, address: text }))
                      }
                    />
                  </View>
                </View>

                <View style={styles.rowDivider} />

                {/* Notes / Tags */}
                <View style={[styles.inputRow, { alignItems: "flex-start", paddingTop: 8 }]}>
                  <View style={[styles.iconBadge, { backgroundColor: "rgba(255,214,10,0.18)", marginTop: 2 }]}>
                    <Ionicons name="document-text" size={14} color="#FFD60A" />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputMiniLabel}>NOTES / TAGS</Text>
                    <TextInput
                      style={[styles.insetTextInput, styles.notesInput]}
                      placeholder="Add meeting notes, context or tags..."
                      placeholderTextColor="#636366"
                      multiline
                      numberOfLines={3}
                      value={editForm.notes}
                      onChangeText={(text) =>
                        setEditForm((prev) => ({ ...prev, notes: text }))
                      }
                    />
                  </View>
                </View>
              </View>

              {/* Group 4: Delete Action Button */}
              <View style={styles.deleteCardGroup}>
                <TouchableOpacity
                  style={styles.deleteContactBtn}
                  onPress={() => {
                    const target = editingCard;
                    setEditingCard(null);
                    handleDeleteCard(target);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash" size={16} color="#FF453A" style={{ marginRight: 8 }} />
                  <Text style={styles.deleteContactBtnText}>Delete Contact from Vault</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
  },
  headerScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0071E3",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#0071E3",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  headerScanBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    paddingVertical: 12,
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  cardItem: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#0071E3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#86868B",
    fontSize: 12,
    marginTop: 1,
  },
  cardCompany: {
    color: "#0071E3",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  cardTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,113,227,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonDelete: {
    backgroundColor: "rgba(255,69,58,0.12)",
  },
  cardDetails: {
    marginBottom: 12,
    paddingVertical: 4,
  },
  detailRowWithAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  detailRowFlex: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  detailWhatsAppPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37, 211, 102, 0.14)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(37, 211, 102, 0.35)",
    marginLeft: 8,
  },
  detailWhatsAppPillText: {
    color: "#25D366",
    fontSize: 11,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  detailIcon: {
    width: 20,
    marginRight: 6,
  },
  detailText: {
    color: "#D1D1D6",
    fontSize: 13,
    flex: 1,
  },
  detailLink: {
    color: "#0071E3",
  },
  notesRow: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  notesText: {
    color: "#8E8E93",
    fontSize: 12,
    fontStyle: "italic",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  actionChipWhatsApp: {
    backgroundColor: "rgba(37, 211, 102, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(37, 211, 102, 0.45)",
  },
  actionChipWhatsAppText: {
    color: "#25D366",
    fontSize: 11,
    fontWeight: "700",
  },
  actionChipPrimary: {
    backgroundColor: "rgba(0,113,227,0.2)",
    borderWidth: 1,
    borderColor: "rgba(0,113,227,0.4)",
    marginLeft: "auto",
  },
  actionChipPrimaryText: {
    color: "#409CFF",
    fontSize: 11,
    fontWeight: "600",
  },
  modalWhatsAppBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(37, 211, 102, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(37, 211, 102, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  actionChipAI: {
    backgroundColor: "rgba(191, 90, 242, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(191, 90, 242, 0.35)",
  },
  actionChipAIText: {
    color: "#BF5AF2",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    marginTop: 14,
  },
  emptySubtitle: {
    color: "#86868B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },

  // -------------------------------------------------------------
  // Apple HIG Bottom-Sheet Modal Styles
  // -------------------------------------------------------------
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  modalDismissArea: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: "#161618",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 24,
  },
  grabberContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabberPill: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  sheetCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sheetCancelText: {
    color: "#8E8E93",
    fontSize: 16,
    fontWeight: "500",
  },
  sheetTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  sheetSaveBtn: {
    backgroundColor: "#0071E3",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 62,
    alignItems: "center",
  },
  sheetSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  sheetBody: {
    flexShrink: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 40,
  },

  // Hero Section
  heroSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 4,
  },
  heroAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#0071E3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 10,
    shadowColor: "#0071E3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  heroAvatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  heroRole: {
    color: "#8E8E93",
    fontSize: 13,
    marginTop: 2,
  },

  // Grouped Inset Card
  sectionHeader: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginLeft: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  groupedCard: {
    backgroundColor: "#202024",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  inputMiniLabel: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  insetTextInput: {
    color: "#FFFFFF",
    fontSize: 15,
    padding: 0,
    fontWeight: "500",
  },
  notesInput: {
    minHeight: 52,
    textAlignVertical: "top",
    paddingTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginLeft: 54,
  },

  // Delete Action Button
  deleteCardGroup: {
    marginTop: 14,
    marginBottom: 16,
  },
  deleteContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 69, 58, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 69, 58, 0.28)",
    borderRadius: 16,
    paddingVertical: 14,
  },
  deleteContactBtnText: {
    color: "#FF453A",
    fontSize: 15,
    fontWeight: "600",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 3,
    gap: 8,
  },
  cloudSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  cloudSyncBadgeOk: {
    backgroundColor: "rgba(48, 209, 88, 0.12)",
    borderColor: "rgba(48, 209, 88, 0.28)",
  },
  cloudSyncBadgeActive: {
    backgroundColor: "rgba(64, 156, 255, 0.14)",
    borderColor: "rgba(64, 156, 255, 0.3)",
  },
  cloudSyncBadgePending: {
    backgroundColor: "rgba(255, 214, 10, 0.14)",
    borderColor: "rgba(255, 214, 10, 0.3)",
  },
  cloudSyncBadgeText: {
    fontSize: 10.5,
    fontWeight: "600",
  },
});
