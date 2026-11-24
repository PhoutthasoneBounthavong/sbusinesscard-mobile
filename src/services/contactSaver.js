import { Linking, Platform } from "react-native";
import { API_BASE } from "../api";

export async function saveToNativeContacts(card, showAlert = null) {
  if (!card) {
    if (typeof showAlert === "function") {
      showAlert({
        title: "Error",
        message: "No contact details provided to save.",
        type: "error",
      });
    }
    return { success: false, error: "No card data provided" };
  }

  const fullName = (card.full_name || "Contact").trim();
  const nameParts = fullName.split(/\s+/);
  const givenName = nameParts[0] || "Contact";
  const familyName = nameParts.slice(1).join(" ") || "";

  // 1. If on native mobile (iOS or Android), attempt direct Native Address Book insertion
  if (Platform.OS !== "web") {
    try {
      let Contacts;
      try {
        Contacts = require("expo-contacts");
      } catch (e) {
        try {
          Contacts = require("expo-contacts/legacy");
        } catch (err) {
          Contacts = null;
        }
      }

      if (Contacts && typeof Contacts.requestPermissionsAsync === "function") {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === "granted") {
          const phones = card.phone
            ? [{ label: "mobile", number: String(card.phone).trim() }]
            : undefined;

          const emails = card.email
            ? [{ label: "work", address: String(card.email).trim(), email: String(card.email).trim() }]
            : undefined;

          const urls = card.website
            ? [{ label: "work", url: String(card.website).trim() }]
            : undefined;

          const addresses = card.address
            ? [{ label: "work", street: String(card.address).trim() }]
            : undefined;

          // Modern Expo SDK 58 API (Required for iOS / SDK 58)
          if (Contacts.Contact && typeof Contacts.Contact.create === "function") {
            await Contacts.Contact.create({
              givenName,
              familyName,
              company: card.company || "",
              jobTitle: card.job_title || "",
              note: card.notes || "Saved with SBusinessCard Scanner",
              phones,
              emails,
              urlAddresses: urls,
              addresses,
            });

            if (typeof showAlert === "function") {
              showAlert({
                title: "Contact Saved",
                message: `"${fullName}" has been added to your phone's address book.`,
                type: "success",
              });
            }
            return { success: true, method: "native" };
          }

          // Legacy expo-contacts fallback
          if (typeof Contacts.addContactAsync === "function") {
            const legacyFields = Contacts.Fields || {};
            const contactData = {
              [legacyFields.FirstName || "firstName"]: givenName,
              [legacyFields.LastName || "lastName"]: familyName,
              [legacyFields.Company || "company"]: card.company || "",
              [legacyFields.JobTitle || "jobTitle"]: card.job_title || "",
              [legacyFields.Note || "note"]: card.notes || "Saved with SBusinessCard Scanner",
            };
            if (phones) contactData[legacyFields.PhoneNumbers || "phoneNumbers"] = phones;
            if (emails) contactData[legacyFields.Emails || "emails"] = emails;
            if (urls) contactData[legacyFields.UrlAddresses || "urlAddresses"] = urls;
            if (addresses) contactData[legacyFields.Addresses || "addresses"] = addresses;

            await Contacts.addContactAsync(contactData);

            if (typeof showAlert === "function") {
              showAlert({
                title: "Contact Saved",
                message: `"${fullName}" has been added to your phone's address book.`,
                type: "success",
              });
            }
            return { success: true, method: "legacy" };
          }
        }
      }
    } catch (nativeErr) {
      console.warn("Direct native contact insertion encountered an issue, trying vCard fallback:", nativeErr);
    }
  }

  // 2. High-reliability vCard Fallback
  // Works 100% on iOS Safari & Android without requiring any native permissions
  try {
    let vcardUrl;
    if (card.id) {
      vcardUrl = `${API_BASE}/cards/${card.id}/vcard`;
    } else {
      const queryParts = [
        `full_name=${encodeURIComponent(fullName)}`,
        `company=${encodeURIComponent(card.company || "")}`,
        `job_title=${encodeURIComponent(card.job_title || "")}`,
        `phone=${encodeURIComponent(card.phone || "")}`,
        `email=${encodeURIComponent(card.email || "")}`,
        `website=${encodeURIComponent(card.website || "")}`,
        `address=${encodeURIComponent(card.address || "")}`,
        `notes=${encodeURIComponent(card.notes || "")}`,
      ];
      vcardUrl = `${API_BASE}/vcard/quick?${queryParts.join("&")}`;
    }

    await Linking.openURL(vcardUrl);
    if (typeof showAlert === "function") {
      showAlert({
        title: "Add Contact",
        message: `Opening "${fullName}" in Contacts. Tap "Save" or "Done" to finish adding.`,
        type: "info",
      });
    }
    return { success: true, method: "vcard" };
  } catch (linkErr) {
    console.error("vCard URL failed:", linkErr);
  }

  // 3. Fallback alert guiding user to permissions if blocked
  if (typeof showAlert === "function") {
    showAlert({
      title: "Contact Permission Needed",
      message: "Please allow SBusinessCard to access Contacts in iPhone Settings to save contacts directly.",
      type: "warning",
      buttons: [
        { text: "Settings", onPress: () => Linking.openSettings() },
        { text: "Dismiss", style: "cancel" },
      ],
    });
  }
  return { success: false, error: "Permissions denied or unsupported" };
}
