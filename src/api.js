import { Platform } from "react-native";

// In Android emulator use 10.0.2.2; on iOS emulator or web use localhost; or set your LAN IP
const DEFAULT_HOST = Platform.OS === "android" ? "http://10.0.2.2:8000/api" : "http://localhost:8000/api";
export const API_BASE = DEFAULT_HOST;

export async function scanBusinessCard(imageUri) {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "card.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: imageUri,
    name: filename,
    type: type,
  });

  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "multipart/form-data",
    },
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to scan card");
  }

  return res.json();
}

export async function saveCardToVault(cardData) {
  const res = await fetch(`${API_BASE}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardData),
  });

  if (!res.ok) throw new Error("Failed to save card");
  return res.json();
}

export async function fetchCards(search = "") {
  const url = search ? `${API_BASE}/cards?search=${encodeURIComponent(search)}` : `${API_BASE}/cards`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load cards");
  return res.json();
}

export async function fetchMyDigitalCard() {
  const res = await fetch(`${API_BASE}/digital-card`);
  if (!res.ok) throw new Error("Failed to load digital card");
  return res.json();
}
