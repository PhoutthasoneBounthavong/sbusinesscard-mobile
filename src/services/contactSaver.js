import { Alert, Linking, Platform } from "react-native";
import { API_BASE } from "../api";

export async function saveToNativeContacts(card) {
  try {
    // Dynamically attempt to use expo-contacts if installed
    let Contacts;
    try {
      Contacts = require("expo-contacts");
    } catch (e) {
      Contacts = null;
    }

    if (Contacts && Platform.OS !== "web") {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === "granted") {
        const nameParts = (card.full_name || "Contact").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const contactData = {
          [Contacts.Fields.FirstName]: firstName,
          [Contacts.Fields.LastName]: lastName,
          [Contacts.Fields.Company]: card.company || "",
          [Contacts.Fields.JobTitle]: card.job_title || "",
          [Contacts.Fields.Note]: "Digitized via Cardr Scanner",
        };

        if (card.phone) {
          contactData[Contacts.Fields.PhoneNumbers] = [
            {
              label: "mobile",
              number: card.phone,
            },
          ];
        }

        if (card.email) {
          contactData[Contacts.Fields.Emails] = [
            {
              label: "work",
              email: card.email,
            },
          ];
        }

        if (card.website) {
          contactData[Contacts.Fields.UrlAddresses] = [
            {
              label: "work",
              url: card.website,
            },
          ];
        }

        await Contacts.addContactAsync(contactData);
        Alert.alert(
          "Contact Saved!",
          `${card.full_name || "Contact"} has been added to your phone's Contacts book.`
        );
        return true;
      }
    }

    // Fallback: Open vCard download URL in phone browser to trigger native iOS / Android Add to Contacts dialog
    const vcardUrl = `${API_BASE}/c/${card.slug || "alex-morgan"}/vcard`;
    await Linking.openURL(vcardUrl);
    return true;
  } catch (error) {
    Alert.alert("Unable to save contact", error.message);
    return false;
  }
}
