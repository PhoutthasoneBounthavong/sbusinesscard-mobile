import { Platform, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Automatically detect the live PC host IP from Metro or environment
function resolveDynamicApiBase() {
  if (process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_API_URL.includes("localhost")) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  try {
    const legacyScriptURL = NativeModules?.SourceCode?.scriptURL;
    if (legacyScriptURL) {
      const match = legacyScriptURL.match(/https?:\/\/(\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1] && match[1] !== "127.0.0.1") {
        return `http://${match[1]}:8000/api`;
      }
    }
  } catch (e) {}

  return process.env.EXPO_PUBLIC_API_URL || "https://entrepreneur-wrist-nodes-mitsubishi.trycloudflare.com/api";
}

export const API_BASE = resolveDynamicApiBase();

// Supabase Online Cloud Backup Config
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://gpqbdbsehgrkkftrqjvd.supabase.co";
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

// Fast fetch helper with timeout so offline/unreachable networks never hang the phone for 60s
async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// --- Auth Token Management ---
const TOKEN_STORAGE_KEY = "@cardr_auth_token";
const USER_STORAGE_KEY = "@cardr_user_profile";
const LOGOUT_FLAG_KEY = "@cardr_explicit_logout";

// User-scoped Local Storage Key helpers (guarantees 100% account isolation)
function getUserVaultKey(userId) {
  return `@sbusinesscard_vault_u_${userId || "guest"}`;
}
function getUserDeletedKey(userId) {
  return `@sbusinesscard_deleted_ids_u_${userId || "guest"}`;
}
function getUserBackupKey(userId) {
  return `@sbusinesscard_last_backup_u_${userId || "guest"}`;
}
function getUserDigitalKey(userId) {
  return `@sbusinesscard_digital_card_u_${userId || "guest"}`;
}

const memoryStorage = {};
let currentUserId = null;
let localVaultCache = null; // Instant 0ms in-memory vault cache
let lastBackupCache = null;
let localDigitalCardCache = null;

export function resetVaultMemoryCache() {
  currentUserId = null;
  localVaultCache = null;
  lastBackupCache = null;
  localDigitalCardCache = null;
}

export async function getStoredToken() {
  try {
    const val = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (val !== null && val !== undefined) return val;
  } catch (e) {}
  if (memoryStorage[LOGOUT_FLAG_KEY]) {
    return null;
  }
  return memoryStorage[TOKEN_STORAGE_KEY] || null;
}

export async function getStoredUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  if (memoryStorage[LOGOUT_FLAG_KEY]) {
    return null;
  }
  const memRaw = memoryStorage[USER_STORAGE_KEY];
  return memRaw ? JSON.parse(memRaw) : null;
}

async function getActiveUserId() {
  const user = await getStoredUser();
  return user?.id ? String(user.id) : "guest";
}

export async function saveAuthSession(token, user) {
  resetVaultMemoryCache();
  delete memoryStorage[LOGOUT_FLAG_KEY];
  memoryStorage[TOKEN_STORAGE_KEY] = token;
  memoryStorage[USER_STORAGE_KEY] = JSON.stringify(user);
  currentUserId = user?.id ? String(user.id) : null;
  try {
    await AsyncStorage.removeItem(LOGOUT_FLAG_KEY);
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {}
}

export async function clearAuthSession() {
  resetVaultMemoryCache();
  memoryStorage[LOGOUT_FLAG_KEY] = "true";
  delete memoryStorage[TOKEN_STORAGE_KEY];
  delete memoryStorage[USER_STORAGE_KEY];
  try {
    await AsyncStorage.setItem(LOGOUT_FLAG_KEY, "true");
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  } catch (e) {}
}

async function getAuthHeaders() {
  const token = await getStoredToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// LOCAL-FIRST VAULT ENGINE + AUTOMATIC ONLINE CLOUD BACKUP
// ============================================================================

export function getLocalVaultCardsSync() {
  return localVaultCache;
}

export function getLastBackupTimeSync() {
  return lastBackupCache;
}

export async function getLocalVaultCards() {
  const uid = await getActiveUserId();
  if (currentUserId === uid && Array.isArray(localVaultCache)) {
    return localVaultCache;
  }
  currentUserId = uid;
  try {
    const vaultKey = getUserVaultKey(uid);
    const backupKey = getUserBackupKey(uid);
    const [raw, backupTime] = await Promise.all([
      AsyncStorage.getItem(vaultKey),
      AsyncStorage.getItem(backupKey),
    ]);
    if (backupTime) lastBackupCache = backupTime;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localVaultCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  localVaultCache = [];
  return [];
}

async function persistLocalVault(cards) {
  const uid = await getActiveUserId();
  currentUserId = uid;
  localVaultCache = cards;
  try {
    await AsyncStorage.setItem(getUserVaultKey(uid), JSON.stringify(cards));
  } catch (e) {}
}

async function getDeletedIds() {
  try {
    const uid = await getActiveUserId();
    const raw = await AsyncStorage.getItem(getUserDeletedKey(uid));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function addDeletedId(id) {
  try {
    const uid = await getActiveUserId();
    const ids = await getDeletedIds();
    const next = Array.from(new Set([...ids, String(id)]));
    await AsyncStorage.setItem(getUserDeletedKey(uid), JSON.stringify(next));
  } catch (e) {}
}

async function removeDeletedId(id) {
  try {
    const uid = await getActiveUserId();
    const ids = await getDeletedIds();
    const next = ids.filter((x) => x !== String(id));
    await AsyncStorage.setItem(getUserDeletedKey(uid), JSON.stringify(next));
  } catch (e) {}
}

function findDuplicateInLocalVault(cards, cardData) {
  const cleanEmail = (cardData.email || "").trim().toLowerCase();
  const cleanPhone = (cardData.phone || "").replace(/[^\d+]/g, "");
  const cleanName = (cardData.full_name || "").trim().toLowerCase();
  const cleanCompany = (cardData.company || "").trim().toLowerCase();

  for (const existing of cards) {
    if (cleanEmail && (existing.email || "").trim().toLowerCase() === cleanEmail) {
      return existing;
    }
    if (cleanPhone.length >= 7) {
      const suffix = cleanPhone.slice(-8);
      const existingPhone = (existing.phone || "").replace(/[^\d+]/g, "");
      if (existingPhone.includes(suffix)) {
        return existing;
      }
    }
    if (
      cleanName &&
      cleanName !== "unnamed contact" &&
      cleanCompany &&
      (existing.full_name || "").trim().toLowerCase() === cleanName &&
      (existing.company || "").trim().toLowerCase() === cleanCompany
    ) {
      return existing;
    }
  }
  return null;
}

// Optional Online Cloud Backup to Supabase REST table if configured
async function backupCardToSupabaseOnline(card) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const uid = await getActiveUserId();
    const payload = {
      user_id: uid && uid !== "guest" ? parseInt(uid, 10) : 1,
      full_name: card.full_name || "Unnamed Contact",
      job_title: card.job_title || "",
      company: card.company || "",
      phone: card.phone || "",
      email: card.email || "",
      website: card.website || "",
      address: card.address || "",
      notes: card.notes || "",
    };
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/scanned_cards`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      },
      3500
    );
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Background cloud push for a single newly saved card
async function pushCardToCloudInBackground(localCard, force = true) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(
      `${API_BASE}/cards`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ...localCard, force }),
      },
      4500
    );

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const serverCard = data.card;
      const current = await getLocalVaultCards();
      const updated = current.map((c) =>
        String(c.id) === String(localCard.id)
          ? { ...c, ...(serverCard || {}), synced: true }
          : c
      );
      await persistLocalVault(updated);
      const nowIso = new Date().toISOString();
      lastBackupCache = nowIso;
      await AsyncStorage.setItem(LAST_BACKUP_KEY, nowIso).catch(() => {});
    }
  } catch (e) {
    // Kept safely in local vault with synced: false for next background sync
  }
  // Also attempt online Supabase backup silently
  backupCardToSupabaseOnline(localCard).catch(() => {});
}

/**
 * Two-way Cloud Backup & Sync:
 * 1. Pushes any pending local deletions & unsynced local cards to the online database
 * 2. Pulls online cards and merges them into the phone's Local Vault
 */
export async function syncVaultWithCloud() {
  const localCards = await getLocalVaultCards();
  const deletedIds = await getDeletedIds();
  let cloudOnline = false;

  try {
    const headers = await getAuthHeaders();

    // 1. Push pending deletions to cloud
    for (const delId of deletedIds) {
      if (!String(delId).startsWith("local_")) {
        try {
          const delRes = await fetchWithTimeout(
            `${API_BASE}/cards/${delId}`,
            { method: "DELETE", headers },
            3500
          );
          if (delRes.ok || delRes.status === 404) {
            await removeDeletedId(delId);
          }
        } catch (e) {}
      } else {
        await removeDeletedId(delId);
      }
    }

    // 2. Push any unsynced local cards to cloud database
    const unsynced = localCards.filter((c) => c.synced === false);
    for (const card of unsynced) {
      try {
        const isLocalOnlyId = String(card.id).startsWith("local_");
        if (isLocalOnlyId) {
          const res = await fetchWithTimeout(
            `${API_BASE}/cards`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({ ...card, force: true }),
            },
            4000
          );
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.card) {
              card.id = data.card.id;
              card.synced = true;
            }
          } else if (res.status === 409) {
            card.synced = true;
          }
        } else {
          const res = await fetchWithTimeout(
            `${API_BASE}/cards/${card.id}`,
            {
              method: "PUT",
              headers,
              body: JSON.stringify(card),
            },
            4000
          );
          if (res.ok) {
            card.synced = true;
          }
        }
      } catch (e) {}
    }

    // 3. Pull latest online cards & merge non-destructively into local vault
    const res = await fetchWithTimeout(`${API_BASE}/cards`, { headers }, 4500);
    if (res.ok) {
      cloudOnline = true;
      const data = await res.json().catch(() => ({}));
      const remoteCards = (data.cards || []).map((rc) => ({ ...rc, synced: true }));
      const activeDeletedIds = await getDeletedIds();

      // Active local cards not explicitly deleted by user
      const activeLocalCards = localCards.filter(
        (c) => !activeDeletedIds.includes(String(c.id))
      );
      const filteredRemote = remoteCards.filter(
        (rc) => !activeDeletedIds.includes(String(rc.id))
      );

      // Build unified non-destructive merged map
      const mergedMap = new Map();
      for (const rc of filteredRemote) {
        mergedMap.set(String(rc.id), rc);
      }

      // Preserve all active local cards: unsynced edits override remote,
      // and local cards not present on remote are NEVER dropped
      for (const lc of activeLocalCards) {
        const localId = String(lc.id);
        if (!mergedMap.has(localId)) {
          mergedMap.set(localId, lc);
        } else {
          if (lc.synced === false) {
            mergedMap.set(localId, { ...mergedMap.get(localId), ...lc });
          }
        }
      }

      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      });

      await persistLocalVault(merged);

      const nowIso = new Date().toISOString();
      lastBackupCache = nowIso;
      await AsyncStorage.setItem(LAST_BACKUP_KEY, nowIso).catch(() => {});

      const pendingCount = merged.filter((c) => c.synced === false).length;
      return {
        cards: merged,
        cloudOnline: true,
        pendingCount,
        lastBackupAt: nowIso,
      };
    }
  } catch (e) {
    cloudOnline = false;
  }

  const pendingCount = localCards.filter((c) => c.synced === false).length;
  return {
    cards: localCards,
    cloudOnline,
    pendingCount,
    lastBackupAt: lastBackupCache,
  };
}

// --- Auth Endpoints ---
export async function loginUser(email, password) {
  const res = await fetchWithTimeout(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, 6000);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Failed to log in.");
  }
  if (data.token && data.user) {
    await saveAuthSession(data.token, data.user);
  }
  return data;
}

export async function registerUser(email, password, fullName) {
  const res = await fetchWithTimeout(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName }),
  }, 6000);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Failed to create account.");
  }
  if (data.token && data.user) {
    await saveAuthSession(data.token, data.user);
  }
  return data;
}

export async function logoutUser() {
  await clearAuthSession();
}

// --- OCR Card Scanner ---
export async function scanBusinessCard(imageUri) {
  const token = await getStoredToken();

  // 1. On Native (Android & iOS), use FileSystem.uploadAsync for bulletproof multipart upload
  if (Platform.OS !== "web") {
    try {
      let FileSystem;
      try {
        FileSystem = require("expo-file-system/legacy");
      } catch (e) {
        FileSystem = require("expo-file-system");
      }

      if (FileSystem && FileSystem.uploadAsync) {
        const uploadType =
          FileSystem.FileSystemUploadType?.MULTIPART ||
          FileSystem.UploadType?.MULTIPART ||
          1;

        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const uploadResult = await FileSystem.uploadAsync(`${API_BASE}/scan`, imageUri, {
          httpMethod: "POST",
          uploadType: uploadType,
          fieldName: "file",
          mimeType: "image/jpeg",
          headers: headers,
        });

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          return JSON.parse(uploadResult.body);
        } else {
          let message = `OCR server responded with status ${uploadResult.status}`;
          try {
            const err = JSON.parse(uploadResult.body);
            message = err.message || err.detail || message;
          } catch (e) {}
          throw new Error(message);
        }
      }
    } catch (err) {
      if (!err.message?.includes("expo-file-system")) {
        throw err;
      }
    }
  }

  // 2. Web & JS fallback using modern File class
  const filename = imageUri.split("/").pop() || "card.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  const formData = new FormData();
  try {
    const { File } = require("expo-file-system");
    formData.append("file", new File(imageUri));
  } catch (e) {
    formData.append("file", {
      uri: imageUri,
      name: filename,
      type: type,
    });
  }

  const reqHeaders = {};
  if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: reqHeaders,
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        errorData.detail ||
        `OCR server responded with status ${res.status}`
    );
  }

  return res.json();
}

// --- Real-time Computer Vision Card Presence Detection ---
export async function detectCardPresence(imageUri) {
  try {
    const filename = imageUri.split("/").pop() || "sample.jpg";
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      name: filename,
      type: "image/jpeg",
    });

    const res = await fetchWithTimeout(`${API_BASE}/detect-card`, {
      method: "POST",
      body: formData,
    }, 3000);

    if (!res.ok) {
      return { has_card: false, reason: "server_error" };
    }
    return await res.json();
  } catch (e) {
    return { has_card: false, reason: "network_error" };
  }
}

// --- Cards Vault CRUD (Instant Local Vault + Background Cloud Backup) ---
export async function saveCardToVault(cardData, force = false) {
  const currentCards = await getLocalVaultCards();

  // 1. Instant 0ms Local Duplicate Detection
  if (!force) {
    const duplicate = findDuplicateInLocalVault(currentCards, cardData);
    if (duplicate) {
      const error = new Error(
        `'${duplicate.full_name}' from '${duplicate.company || "this company"}' already exists in your Cards Vault.`
      );
      error.already_exists = true;
      error.existing_card = duplicate;
      throw error;
    }
  }

  // 2. Save immediately to Phone's Local Vault (0ms wait!)
  const nowIso = new Date().toISOString();
  const newLocalCard = {
    id: `local_${Date.now()}`,
    full_name: (cardData.full_name || "Unnamed Contact").trim(),
    job_title: (cardData.job_title || "").trim(),
    company: (cardData.company || "").trim(),
    phone: (cardData.phone || "").trim(),
    email: (cardData.email || "").trim(),
    website: (cardData.website || "").trim(),
    address: (cardData.address || "").trim(),
    notes: (cardData.notes || "").trim(),
    tags: (cardData.tags || "").trim(),
    raw_text: (cardData.raw_text || "").trim(),
    image_url: cardData.image_url || "",
    created_at: nowIso,
    updated_at: nowIso,
    synced: false, // Pending background cloud backup
  };

  const nextCards = [newLocalCard, ...currentCards];
  await persistLocalVault(nextCards);

  // 3. Fire-and-forget background cloud backup (does not block user!)
  pushCardToCloudInBackground(newLocalCard, true);

  return { success: true, card: newLocalCard, savedLocally: true };
}

export async function updateCardInVault(cardId, cardData) {
  // 1. Instant 0ms Local Vault Update
  const currentCards = await getLocalVaultCards();
  let updatedCard = null;
  const nextCards = currentCards.map((c) => {
    if (String(c.id) === String(cardId)) {
      updatedCard = {
        ...c,
        ...cardData,
        updated_at: new Date().toISOString(),
        synced: false,
      };
      return updatedCard;
    }
    return c;
  });
  await persistLocalVault(nextCards);

  // 2. Background Cloud Sync
  if (!String(cardId).startsWith("local_")) {
    getAuthHeaders()
      .then((headers) =>
        fetchWithTimeout(
          `${API_BASE}/cards/${cardId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(cardData),
          },
          4500
        )
      )
      .then(async (res) => {
        if (res.ok) {
          const latest = await getLocalVaultCards();
          await persistLocalVault(
            latest.map((c) =>
              String(c.id) === String(cardId) ? { ...c, synced: true } : c
            )
          );
        }
      })
      .catch(() => {});
  }

  return { success: true, card: updatedCard || { id: cardId, ...cardData } };
}

export async function deleteCardFromVault(cardId) {
  // 1. Instant 0ms Local Vault Removal
  const currentCards = await getLocalVaultCards();
  const nextCards = currentCards.filter((c) => String(c.id) !== String(cardId));
  await persistLocalVault(nextCards);
  await addDeletedId(cardId);

  // 2. Background Cloud Delete
  if (!String(cardId).startsWith("local_")) {
    getAuthHeaders()
      .then((headers) =>
        fetchWithTimeout(
          `${API_BASE}/cards/${cardId}`,
          { method: "DELETE", headers },
          4500
        )
      )
      .then((res) => {
        if (res.ok || res.status === 404) {
          removeDeletedId(cardId);
        }
      })
      .catch(() => {});
  } else {
    removeDeletedId(cardId);
  }

  return { success: true };
}

export async function fetchCards(search = "") {
  // Return local vault cards immediately, or sync if local vault is empty
  let cards = await getLocalVaultCards();
  if (cards.length === 0) {
    const syncRes = await syncVaultWithCloud();
    cards = syncRes.cards || [];
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    cards = cards.filter(
      (c) =>
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.job_title || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }
  return { cards, total: cards.length };
}

export function getLocalDigitalCardSync() {
  return localDigitalCardCache;
}

export async function fetchMyDigitalCard() {
  const uid = await getActiveUserId();
  const digitalKey = getUserDigitalKey(uid);
  if (!localDigitalCardCache) {
    try {
      const raw = await AsyncStorage.getItem(digitalKey);
      if (raw) localDigitalCardCache = JSON.parse(raw);
    } catch (e) {}
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/digital-card`, { headers }, 4000);
    if (res.ok) {
      const data = await res.json();
      if (data.card) {
        localDigitalCardCache = data.card;
        await AsyncStorage.setItem(digitalKey, JSON.stringify(data.card)).catch(() => {});
        return data;
      }
    }
  } catch (e) {}

  if (localDigitalCardCache) {
    return { card: localDigitalCardCache };
  }
  throw new Error("Failed to load digital card");
}

export async function saveMyDigitalCard(cardData) {
  const uid = await getActiveUserId();
  const digitalKey = getUserDigitalKey(uid);
  // 1. Save immediately in Phone's Local Vault (0ms)
  const merged = { ...(localDigitalCardCache || {}), ...cardData };
  localDigitalCardCache = merged;
  try {
    await AsyncStorage.setItem(digitalKey, JSON.stringify(merged));
  } catch (e) {}

  // 2. Sync to Cloud Backend in background
  try {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(
      `${API_BASE}/digital-card`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(merged),
      },
      4500
    );
    if (res.ok) {
      const data = await res.json();
      if (data.card) {
        localDigitalCardCache = data.card;
        await AsyncStorage.setItem(LOCAL_DIGITAL_CARD_KEY, JSON.stringify(data.card)).catch(() => {});
        return { success: true, card: data.card, cloudSynced: true };
      }
    }
  } catch (e) {}

  return { success: true, card: merged, cloudSynced: false };
}

export async function generateFollowupMessage(cardId, context = "") {
  const headers = await getAuthHeaders();
  const res = await fetchWithTimeout(
    `${API_BASE}/cards/${cardId}/followup`,
    {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ context }),
    },
    8000
  );
  if (!res.ok) throw new Error("Failed to generate follow-up message");
  return res.json();
}

export async function fetchDigitalCardQr(slug = null) {
  try {
    const headers = await getAuthHeaders();
    const query = slug ? `?slug=${encodeURIComponent(slug)}` : "";
    const res = await fetchWithTimeout(
      `${API_BASE}/digital-card/qr${query}`,
      { headers },
      4500
    );
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return null;
}
