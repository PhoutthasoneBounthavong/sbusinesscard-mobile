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

  // 1. Direct Native Address Book insertion (iOS & Android)
  if (Platform.OS !== "web") {
    try {
      let Contacts = null;

      // Try expo-contacts/legacy first (official Expo SDK 58 way to add contacts without deprecation errors)
      try {
        Contacts = require("expo-contacts/legacy");
      } catch (e) {
        try {
          Contacts = require("expo-contacts");
        } catch (err) {
          Contacts = null;
        }
      }

      if (Contacts && typeof Contacts.requestPermissionsAsync === "function") {
        const permResult = await Contacts.requestPermissionsAsync();
        const status = permResult?.status;

        if (status === "granted") {
          const phones = card.phone
            ? [{ label: "mobile", number: String(card.phone).trim() }]
            : [];

          const emails = card.email
            ? [{ label: "work", email: String(card.email).trim(), address: String(card.email).trim() }]
            : [];

          const urls = card.website
            ? [{ label: "work", url: String(card.website).trim() }]
            : [];

          const addresses = card.address
            ? [{ label: "work", street: String(card.address).trim() }]
            : [];

          // Format compatible with both legacy and new Contact APIs
          const contactData = {
            firstName: givenName,
            lastName: familyName,
            givenName,
            familyName,
            company: card.company || "",
            jobTitle: card.job_title || "",
            note: card.notes || "Saved with SBusinessCard Scanner",
            phoneNumbers: phones,
            phones,
            emails,
            urlAddresses: urls,
            addresses,
          };

          // Try addContactAsync (legacy module - works on all iOS Expo Go versions)
          if (typeof Contacts.addContactAsync === "function") {
            try {
              await Contacts.addContactAsync(contactData);
              if (typeof showAlert === "function") {
                showAlert({
                  title: "Contact Saved!",
                  message: `"${fullName}" has been added to your phone's address book.`,
                  type: "success",
                });
              }
              return { success: true, method: "native_legacy" };
            } catch (addErr) {
              console.warn("Contacts.addContactAsync error:", addErr);
            }
          }

          // Try Contact.create (modern Expo SDK 58 class API)
          if (Contacts.Contact && typeof Contacts.Contact.create === "function") {
            try {
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
                  title: "Contact Saved!",
                  message: `"${fullName}" has been added to your phone's address book.`,
                  type: "success",
                });
              }
              return { success: true, method: "native_class" };
            } catch (createErr) {
              console.warn("Contact.create error:", createErr);
            }
          }
        } else {
          // Permission denied
          if (typeof showAlert === "function") {
            showAlert({
              title: "Contacts Permission Needed",
              message: "Please allow SBusinessCard (or Expo Go) to access Contacts in iPhone Settings to save contacts directly.",
              type: "warning",
              buttons: [
                { text: "Open Settings", onPress: () => Linking.openSettings() },
                { text: "Cancel", style: "cancel" },
              ],
            });
          }
          return { success: false, error: "Permission denied" };
        }
      }
    } catch (nativeErr) {
      console.warn("Native contact insertion encountered error:", nativeErr);
    }
  }

  // 2. High-reliability vCard Fallback
  // Opens Apple iOS native Contacts sheet to save contact
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

  if (typeof showAlert === "function") {
    showAlert({
      title: "Unable to Save Contact",
      message: "Please check that Contacts permission is enabled in iPhone Settings.",
      type: "error",
      buttons: [
        { text: "Open Settings", onPress: () => Linking.openSettings() },
        { text: "OK", style: "cancel" },
      ],
    });
  }

  return { success: false, error: "Failed to save contact" };
}
