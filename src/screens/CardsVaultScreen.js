import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
} from "react-native";
import { fetchCards } from "../api";
import { saveToNativeContacts } from "../services/contactSaver";

export default function CardsVaultScreen() {
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCards = async () => {
    setLoading(true);
    try {
      const res = await fetchCards(search);
      setCards(res.cards || []);
    } catch (err) {
      // Fallback demo cards if backend not reachable on LAN
      setCards([
        {
          id: 1,
          full_name: "Alex Morgan",
          job_title: "Chief Executive Officer",
          company: "Aura Technologies Inc.",
          phone: "+1 (555) 234-5678",
          email: "alex.morgan@auratech.io",
          website: "https://auratech.io",
        },
        {
          id: 2,
          full_name: "Elena Rostova",
          job_title: "VP of Product Engineering",
          company: "Quantum Labs",
          phone: "+1 (555) 876-5432",
          email: "elena@quantumlabs.ai",
          website: "https://quantumlabs.ai",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [search]);

  const handleCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  const renderCard = ({ item }) => (
    <View style={styles.cardItem}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.full_name || "C")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.full_name || "Contact"}</Text>
          <Text style={styles.cardTitle}>{item.job_title || ""}</Text>
          <Text style={styles.cardCompany}>{item.company || ""}</Text>
        </View>
      </View>

      {/* Quick Action Chips */}
      <View style={styles.actionsRow}>
        {item.phone ? (
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => handleCall(item.phone)}
          >
            <Text style={styles.actionChipText}>Call</Text>
          </TouchableOpacity>
        ) : null}

        {item.email ? (
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => handleEmail(item.email)}
          >
            <Text style={styles.actionChipText}>Email</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.actionChip, styles.actionChipPrimary]}
          onPress={() => saveToNativeContacts(item)}
        >
          <Text style={styles.actionChipPrimaryText}>+ Add to Phone</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cards Vault</Text>
        <Text style={styles.headerSubtitle}>{cards.length} Digitized Cards</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, company, email..."
          placeholderTextColor="#86868B"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadCards}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
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
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: "#1C1C1E",
    color: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#0071E3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
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
    color: "#409CFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingTop: 12,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
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
});
