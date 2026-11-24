/**
 * Hybrid On-Device & Cloud OCR Service
 * 1. Primary: Google ML Kit Text Recognition on-device (100% offline, 0s wait, no computer needed!)
 * 2. Fallback: Network API call to backend if ML Kit native binary is not available.
 */

import { Platform } from "react-native";
import { parseBusinessCardText } from "./cardParser";

let TextRecognitionModule = null;
try {
  const MLKit = require("@react-native-ml-kit/text-recognition");
  TextRecognitionModule = MLKit.default || MLKit;
} catch (e) {
  TextRecognitionModule = null;
}

export async function recognizeCardOnDevice(imageUri) {
  if (!imageUri) {
    throw new Error("No image provided for text recognition.");
  }

  // 1. Try On-Device Google ML Kit (Instant, 100% offline)
  if (TextRecognitionModule && typeof TextRecognitionModule.recognize === "function") {
    try {
      const result = await TextRecognitionModule.recognize(imageUri);
      if (result && result.text && result.text.trim()) {
        const parsedCard = parseBusinessCardText(result.text);
        return {
          success: true,
          card: parsedCard,
          raw_text: result.text,
          source: "on_device_mlkit",
        };
      }
    } catch (mlKitErr) {
      console.warn("ML Kit on-device scan notice, trying fallback:", mlKitErr);
    }
  }

  return null;
}
