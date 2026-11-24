import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  StatusBar,
  Platform,
  useWindowDimensions,
  Modal,
  TouchableWithoutFeedback,
  Vibration,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { scanBusinessCard, saveCardToVault, updateCardInVault } from "../api";
import { saveToNativeContacts } from "../services/contactSaver";
import { parseQrContact } from "../services/qrParser";
import { useAlert } from "../context/AlertContext";

export default function ScannerScreen({ onNavigateToVault, onClose, insets }) {
  const { showAlert } = useAlert();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [cameraLayout, setCameraLayout] = useState(null);

  const camW = cameraLayout?.width || screenWidth;
  const camH = cameraLayout?.height || screenHeight;

  // Exact mathematical centering calculation for RCTView (guide frame)
  let cardWidth = Math.min(Math.floor(camW * 0.86), 340);
  if ((camW - cardWidth) % 2 !== 0) cardWidth -= 1;

  let cardHeight = Math.round(cardWidth / 1.6);
  if ((camH - cardHeight) % 2 !== 0) cardHeight -= 1;

  const frameLeft = (camW - cardWidth) / 2;
  const frameTop = (camH - cardHeight) / 2;

  const [imageUri, setImageUri] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cardData, setCardData] = useState(null);
  const [duplicateNotice, setDuplicateNotice] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [torch, setTorch] = useState(false);
  const isCapturingRef = useRef(false);

  // Live 60 FPS Hardware QR Code Scanner & Contact Auto-Parser
  const qrCooldownRef = useRef(false);

  const handleBarcodeScanned = (scanningResult) => {
    if (scanning || cardData || qrCooldownRef.current) return;
    if (!scanningResult || !scanningResult.data) return;

    qrCooldownRef.current = true;
    try {
      Vibration.vibrate(Platform.OS === "android" ? 50 : 25);
    } catch (e) {}

    const parsed = parseQrContact(scanningResult.data);
    if (parsed) {
      setCardData(parsed);
      showAlert({
        title: "QR Code Detected!",
        message: `Extracted details for "${parsed.full_name || "Contact"}" from business card QR.`,
        type: "success",
      });
    } else {
      setCardData({
        full_name: "QR Contact",
        notes: `Scanned QR: ${scanningResult.data}`,
      });
      showAlert({
        title: "QR Code Detected!",
        message: `Scanned: ${scanningResult.data.slice(0, 100)}`,
        type: "info",
      });
    }

    // Cooldown prevents duplicate alerts while holding camera over QR
    setTimeout(() => {
      qrCooldownRef.current = false;
    }, 3000);
  };

  // Automatically request camera permission on mount so live camera starts immediately
  useEffect(() => {
    (async () => {
      try {
        if (!permission || !permission.granted) {
          await requestPermission();
        }
      } catch (e) {
        console.warn("Camera permission request notice:", e);
      }
    })();
  }, []);

  // Safe area values
  const topSafeArea = Math.max(
    insets?.top || 0,
    Platform.OS === "android" ? StatusBar.currentHeight || 24 : 16
  );
  const bottomSafeArea = Math.max(
    insets?.bottom || 0,
    Platform.OS === "ios" ? 24 : 16
  );

  // Close handler: exit the scanning screen
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (onNavigateToVault) {
      onNavigateToVault();
    }
  };

  // Retake handler: reset state and return to camera screen
  const handleRetake = () => {
    setCardData(null);
    setImageUri(null);
    isCapturingRef.current = false;
    qrCooldownRef.current = false;
  };

  // Primary In-App Camera Capture (100% inside app, NO external camera apps, NO system modals)
  const handleInAppCapture = async () => {
    if (scanning) return;

    if (!permission?.granted) {
      showAlert({
        title: "Camera Access Required",
        message: "Please allow camera access to scan business cards.",
        type: "warning",
      });
      return;
    }

    if (!cameraRef.current || !isCameraReady || cameraError) {
      showAlert({
        title: "Camera Starting",
        message: "Camera preview is initializing. Please wait a moment.",
        type: "info",
      });
      return;
    }

    try {
      setScanning(true);
      try {
        Vibration.vibrate(Platform.OS === "android" ? 40 : 20);
      } catch (e) {}

      // 1. Capture photo directly from the embedded in-app CameraView
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        shutterSound: false,
      });

      if (!photo?.uri) {
        throw new Error("Could not capture image from camera.");
      }

      // 2. Crop photo precisely to the in-app viewfinder frame (+ generous safety margin)
      const croppedUri = await cropToViewfinder(photo);

      // 3. Send cropped card to AI Vision OCR
      setImageUri(croppedUri);
      await processOcr(croppedUri);
    } catch (err) {
      console.warn("In-app camera capture notice:", err);
      showAlert({
        title: "Capture Notice",
        message: err.message || "Could not capture image. Please hold phone steady and try again.",
        type: "warning",
      });
      setScanning(false);
    }
  };

  const handleCapturePress = () => {
    handleInAppCapture();
  };

  // Smart crop photo to the viewfinder bounds + generous safety margin ("a bit outside the frame")
  const cropToViewfinder = async (photo) => {
    try {
      let origWidth = photo.width;
      let origHeight = photo.height;
      if (!origWidth || !origHeight) return photo.uri;

      const currentCamW = cameraLayout?.width || screenWidth;
      const currentCamH = cameraLayout?.height || screenHeight;

      let currentUri = photo.uri;

      // Single-pass orientation + crop + resize so the phone only decodes/encodes once!
      const actions = [];
      if (origWidth > origHeight && currentCamW < currentCamH) {
        actions.push({ rotate: 90 });
        origWidth = photo.height;
        origHeight = photo.width;
      }

      // Live camera preview aspect-fill projection:
      // CameraView (with StyleSheet.absoluteFill) covers the container using AspectFill.
      const scale = Math.max(currentCamW / origWidth, currentCamH / origHeight);
      const renderedWidth = origWidth * scale;
      const renderedHeight = origHeight * scale;

      const offsetX = (renderedWidth - currentCamW) / 2;
      const offsetY = (renderedHeight - currentCamH) / 2;

      // Expand frame bounds by 35% safety margin ("a bit outside the frame")
      const marginFactor = 1.35;
      const cropScreenWidth = Math.min(cardWidth * marginFactor, currentCamW);
      const cropScreenHeight = Math.min(cardHeight * marginFactor, currentCamH);

      const cropScreenLeft = (frameLeft + cardWidth / 2) - cropScreenWidth / 2;
      const cropScreenTop = (frameTop + cardHeight / 2) - cropScreenHeight / 2;

      // Map from screen pixels to raw photo pixels
      const rawOriginX = Math.round((cropScreenLeft + offsetX) / scale);
      const rawOriginY = Math.round((cropScreenTop + offsetY) / scale);
      const rawWidth = Math.round(cropScreenWidth / scale);
      const rawHeight = Math.round(cropScreenHeight / scale);

      // Clamp safely within photo bounds
      const originX = Math.max(0, Math.min(rawOriginX, origWidth - 50));
      const originY = Math.max(0, Math.min(rawOriginY, origHeight - 50));
      const width = Math.min(rawWidth, origWidth - originX);
      const height = Math.min(rawHeight, origHeight - originY);

      actions.push({ crop: { originX, originY, width, height } });
      actions.push({ resize: { width: 1000 } });

      const manipResult = await ImageManipulator.manipulateAsync(
        currentUri,
        actions,
        { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG }
      );

      return manipResult.uri;
    } catch (cropErr) {
      console.warn("Viewfinder crop notice, fallback to full photo:", cropErr);
      return photo.uri;
    }
  };

  // Capture photo from live CameraView (Single deliberate tap, NO loops, NO external apps)
  const handleTakePhoto = () => {
    handleCapturePress();
  };

  // Select an existing business card image from device gallery
  const handlePickFromGallery = async () => {
    if (scanning) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert({
          title: "Gallery Permission Required",
          message: "Please allow photo library access to choose a card photo.",
          type: "warning",
          buttons: [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        await processOcr(uri);
      }
    } catch (err) {
      showAlert({
        title: "Gallery Error",
        message: err.message || "Failed to select photo",
        type: "error",
      });
    }
  };

  // OCR Processing: sends image to FastAPI backend
  const processOcr = async (uri) => {
    setScanning(true);
    try {
      const res = await scanBusinessCard(uri);
      if (res && res.card) {
        setCardData(res.card);
      } else {
        throw new Error("Could not extract contact info from this image.");
      }
    } catch (err) {
      showAlert({
        title: "Scan Notice",
        message:
          (err.message || "Could not read business card") +
          "\n\nPlease ensure good lighting and clear alignment within the frame, then try again.",
        type: "warning",
      });
    } finally {
      setScanning(false);
    }
  };

  // 1. Save to Cards Vault only
  const handleSaveToVault = async (forceSave = false) => {
    if (!cardData || saving) return;
    setSaving(true);
    try {
      await saveCardToVault(cardData, forceSave);
      showAlert({
        title: "Saved to Vault",
        message: `"${cardData.full_name || "Contact"}" is now stored in your Cards Vault.`,
        type: "success",
        buttons: [
          { text: "Scan Another", onPress: handleRetake },
          {
            text: "Open Vault",
            onPress: () => {
              handleRetake();
              if (onNavigateToVault) onNavigateToVault();
            },
          },
        ],
      });
    } catch (err) {
      if (err.already_exists && err.existing_card) {
        // Trigger the beautiful Apple HIG Duplicate Modal
        setDuplicateNotice({ existingCard: err.existing_card, isSavingBoth: false });
      } else {
        showAlert({
          title: "Vault Save Notice",
          message: err.message || "Failed to save card to vault.",
          type: "error",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // 2. Save to Phone Contacts only
  const handleSaveToContacts = async () => {
    if (!cardData || saving) return;
    setSaving(true);
    try {
      const result = await saveToNativeContacts(cardData, showAlert);
      if (result && result.success) {
        if (result.method !== "vcard") {
          showAlert({
            title: "Contact Saved",
            message: `"${cardData.full_name || "Contact"}" has been added to your phone's address book.`,
            type: "success",
          });
        }
      }
    } catch (err) {
      showAlert({
        title: "Contacts Notice",
        message: err.message || "Failed to add to phone contacts.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // 3. Save to Both (Cards Vault + Phone Contacts)
  const handleSaveToBoth = async (forceSave = false) => {
    if (!cardData || saving) return;
    setSaving(true);
    try {
      const savedResult = await saveCardToVault(cardData, forceSave);
      const cardToUse = (savedResult && savedResult.card) ? { ...cardData, id: savedResult.card.id } : cardData;
      await saveToNativeContacts(cardToUse);
      showAlert({
        title: "Saved to Both!",
        message: `"${cardData.full_name || "Contact"}" has been saved to your Cards Vault and added to your Phone Contacts.`,
        type: "success",
        buttons: [
          { text: "Scan Another", onPress: handleRetake },
          {
            text: "Open Vault",
            onPress: () => {
              handleRetake();
              if (onNavigateToVault) onNavigateToVault();
            },
          },
        ],
      });
    } catch (err) {
      if (err.already_exists && err.existing_card) {
        // Trigger the beautiful Apple HIG Duplicate Modal
        setDuplicateNotice({ existingCard: err.existing_card, isSavingBoth: true });
      } else {
        showAlert({
          title: "Save Notice",
          message: err.message || "Failed to save card.",
          type: "error",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // Modal Handlers for Duplicate Resolution
  const handleConfirmUpdateExisting = async () => {
    if (!duplicateNotice?.existingCard || !cardData || saving) return;
    setSaving(true);
    try {
      await updateCardInVault(duplicateNotice.existingCard.id, cardData);
      if (duplicateNotice.isSavingBoth) {
        await saveToNativeContacts(cardData);
      }
      const updatedName = duplicateNotice.existingCard.full_name || "Contact";
      setDuplicateNotice(null);
      showAlert({
        title: "Contact Updated",
        message: `"${updatedName}" has been updated with the latest details.`,
        type: "success",
        buttons: [
          { text: "Scan Another", onPress: handleRetake },
          {
            text: "Open Vault",
            onPress: () => {
              handleRetake();
              if (onNavigateToVault) onNavigateToVault();
            },
          },
        ],
      });
    } catch (updateErr) {
      showAlert({
        title: "Update Notice",
        message: updateErr.message || "Failed to update contact.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSaveDuplicate = async () => {
    const isBoth = duplicateNotice?.isSavingBoth;
    setDuplicateNotice(null);
    if (isBoth) {
      await handleSaveToBoth(true);
    } else {
      await handleSaveToVault(true);
    }
  };

  // -------------------------------------------------------------
  // STATE 1: Permissions Loading
  // -------------------------------------------------------------
  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
        <ActivityIndicator size="large" color="#0071E3" />
        <Text style={styles.loadingText}>Opening camera...</Text>
      </View>
    );
  }

  // -------------------------------------------------------------
  // STATE 2: Permission Denied or Not Yet Granted
  // -------------------------------------------------------------
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

        {/* Top-left Close button */}
        <TouchableOpacity
          style={[styles.closeButtonAbsolute, { top: topSafeArea + 10 }]}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close-outline" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="camera-outline" size={48} color="#0071E3" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            To scan business cards with live camera preview, please enable camera access.
          </Text>

          <TouchableOpacity
            style={styles.permissionBtnPrimary}
            onPress={async () => {
              const res = await requestPermission();
              if (!res.granted && !res.canAskAgain) {
                showAlert({
                  title: "Permission Denied",
                  message:
                    "Camera access is disabled in system settings. Please enable it to use the live camera.",
                  type: "warning",
                  buttons: [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                  ],
                });
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.permissionBtnPrimaryText}>Allow Camera Access</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.permissionBtnSecondary}
            onPress={handlePickFromGallery}
            activeOpacity={0.7}
          >
            <Ionicons
              name="images-outline"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.permissionBtnSecondaryText}>
              Choose from Gallery
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------
  // STATE 3: Camera Scanning Screen (iOS Camera Experience)
  // -------------------------------------------------------------
  if (!cardData) {
    return (
      <View
        style={styles.cameraContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setCameraLayout({ width, height });
          }
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* 1. Full-screen live in-app camera preview background */}
        <CameraView
          key="live-camera-view"
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          flash="off"
          animateShutter={false}
          enableTorch={torch}
          onCameraReady={() => {
            setIsCameraReady(true);
            setCameraError(false);
          }}
          onMountError={(err) => {
            console.warn("Camera mount error:", err);
            setCameraError(true);
          }}
        />

        {/* Camera Starting / Initializing indicator */}
        {!isCameraReady && !cameraError && (
          <View style={styles.cameraStatusOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#0071E3" />
            <Text style={styles.cameraStatusText}>Starting camera preview...</Text>
          </View>
        )}

        {/* 2. Top Bar: Close Button (Left), Segmented Mode Switcher (Center), Flashlight (Right) */}
        <View style={[styles.topControlsRow, { top: topSafeArea + 10 }]}>
          <TouchableOpacity
            style={styles.closeButtonCircular}
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.topTitleBadge}>
            <Ionicons name="camera-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.topBarTitle}>Scan Business Card</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.closeButtonCircular,
              torch && styles.flashButtonActive,
            ]}
            onPress={() => setTorch((t) => !t)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={torch ? "flash" : "flash-off-outline"}
              size={20}
              color={torch ? "#FFD60A" : "#FFFFFF"}
            />
          </TouchableOpacity>
        </View>

        {/* 3. The In-App Guide Frame: Tap anywhere to scan */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleCapturePress}
          style={[
            styles.guideFrame,
            {
              left: frameLeft,
              top: frameTop,
              width: cardWidth,
              height: cardHeight,
            },
          ]}
        >
          {/* 4 Corner Accents */}
          <View style={[styles.corner, styles.topLeft]} pointerEvents="none" />
          <View style={[styles.corner, styles.topRight]} pointerEvents="none" />
          <View style={[styles.corner, styles.bottomLeft]} pointerEvents="none" />
          <View style={[styles.corner, styles.bottomRight]} pointerEvents="none" />

          {/* Instruction anchored directly above the frame */}
          <Text style={styles.guideInstruction}>
            Align business card inside frame
          </Text>

          {/* Subtitle anchored directly below the frame */}
          <Text style={styles.guideSubInstruction}>
            Tap shutter button to snap and scan
          </Text>

          {/* If live preview has an issue */}
          {cameraError && !scanning && (
            <View style={styles.cameraFallbackBox}>
              <Ionicons name="alert-circle-outline" size={30} color="#FFD60A" />
              <Text style={styles.cameraFallbackTitle}>Camera preview interrupted</Text>
              <TouchableOpacity
                style={styles.cameraFallbackBtn}
                onPress={() => {
                  setCameraError(false);
                  setIsCameraReady(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.cameraFallbackBtnText}>Retry Preview</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scanning / Loading indicator inside frame */}
          {scanning && (
            <View style={styles.scanningOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#0071E3" />
              <Text style={styles.scanningOverlayText}>
                Scanning business card...
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 4. Bottom Controls Bar: Pinned above the bottom tab bar */}
        <View
          style={[
            styles.bottomControlsBarAbsolute,
            { bottom: (insets?.bottom || 0) + 68 },
          ]}
          pointerEvents="box-none"
        >
          {/* Gallery Button */}
          <TouchableOpacity
            style={styles.controlIconBtn}
            onPress={handlePickFromGallery}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={24} color="#FFFFFF" />
            <Text style={styles.controlBtnLabel}>Gallery</Text>
          </TouchableOpacity>

          {/* Large In-App Circular Capture Button */}
          <TouchableOpacity
            style={styles.captureButtonOuter}
            onPress={handleCapturePress}
            disabled={scanning}
            activeOpacity={0.8}
          >
            <View style={styles.captureButtonInner}>
              <Ionicons name="camera" size={26} color="#0071E3" />
            </View>
          </TouchableOpacity>

          {/* Flash / Torch Quick Toggle Button */}
          <TouchableOpacity
            style={styles.controlIconBtn}
            onPress={() => setTorch((t) => !t)}
            activeOpacity={0.7}
          >
            <View style={[styles.smartScanIconCircle, torch && styles.flashActiveCircle]}>
              <Ionicons
                name={torch ? "flash" : "flash-outline"}
                size={20}
                color={torch ? "#FFD60A" : "#FFFFFF"}
              />
            </View>
            <Text style={[styles.controlBtnLabel, torch && { color: "#FFD60A" }]}>
              {torch ? "Flash On" : "Flash"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------
  // STATE 4: Scan Result Screen (Clean Modern iOS Style)
  // -------------------------------------------------------------
  return (
    <View style={styles.resultContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Navigation Bar with Back Button and Title */}
      <View style={[styles.navBar, { paddingTop: topSafeArea }]}>
        <TouchableOpacity
          style={styles.navBackButton}
          onPress={handleRetake}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back-outline" size={26} color="#0071E3" />
        </TouchableOpacity>

        <Text style={styles.navTitle}>Scan result</Text>

        {/* Right balance spacer */}
        <View style={styles.navRightPlaceholder} />
      </View>

      <ScrollView
        style={styles.resultScrollView}
        contentContainerStyle={[
          styles.resultScrollContent,
          { paddingBottom: bottomSafeArea + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. White, rounded summary card at top */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryName}>
            {cardData.full_name || "Name not detected"}
          </Text>

          {(cardData.job_title || cardData.company) ? (
            <Text style={styles.summaryRole}>
              {[cardData.job_title, cardData.company]
                .filter(Boolean)
                .join(" at ")}
            </Text>
          ) : null}

          {cardData.email ? (
            <Text style={styles.summaryContact}>{cardData.email}</Text>
          ) : null}

          {cardData.phone ? (
            <Text style={styles.summaryContact}>{cardData.phone}</Text>
          ) : null}
        </View>

        {/* 2. Second white, rounded card with separate icon rows */}
        <View style={styles.detailsCard}>
          {/* Row: Name */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrapper}>
              <Ionicons name="person-outline" size={20} color="#0071E3" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>NAME</Text>
              <TextInput
                style={styles.detailInput}
                value={cardData.full_name || ""}
                placeholder="Full name"
                placeholderTextColor="#8E8E93"
                onChangeText={(text) =>
                  setCardData({ ...cardData, full_name: text })
                }
              />
            </View>
          </View>

          <View style={styles.rowSeparator} />

          {/* Row: Title and company */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrapper}>
              <Ionicons name="briefcase-outline" size={20} color="#0071E3" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>TITLE AND COMPANY</Text>
              <TextInput
                style={styles.detailInput}
                value={cardData.job_title || ""}
                placeholder="Job title"
                placeholderTextColor="#8E8E93"
                onChangeText={(text) =>
                  setCardData({ ...cardData, job_title: text })
                }
              />
              <TextInput
                style={[styles.detailInput, styles.detailInputSecondary]}
                value={cardData.company || ""}
                placeholder="Company"
                placeholderTextColor="#8E8E93"
                onChangeText={(text) =>
                  setCardData({ ...cardData, company: text })
                }
              />
            </View>
          </View>

          <View style={styles.rowSeparator} />

          {/* Row: Work phone */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrapper}>
              <Ionicons name="call-outline" size={20} color="#0071E3" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>WORK PHONE</Text>
              <TextInput
                style={styles.detailInput}
                value={cardData.phone || ""}
                placeholder="Phone number"
                placeholderTextColor="#8E8E93"
                keyboardType="phone-pad"
                onChangeText={(text) =>
                  setCardData({ ...cardData, phone: text })
                }
              />
            </View>
          </View>

          <View style={styles.rowSeparator} />

          {/* Row: Email */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrapper}>
              <Ionicons name="mail-outline" size={20} color="#0071E3" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>EMAIL</Text>
              <TextInput
                style={styles.detailInput}
                value={cardData.email || ""}
                placeholder="Email address"
                placeholderTextColor="#8E8E93"
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(text) =>
                  setCardData({ ...cardData, email: text })
                }
              />
            </View>
          </View>

          <View style={styles.rowSeparator} />

          {/* Row: Address */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrapper}>
              <Ionicons name="location-outline" size={20} color="#0071E3" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>ADDRESS</Text>
              <TextInput
                style={styles.detailInput}
                value={cardData.address || ""}
                placeholder="Business address"
                placeholderTextColor="#8E8E93"
                multiline
                onChangeText={(text) =>
                  setCardData({ ...cardData, address: text })
                }
              />
            </View>
          </View>
        </View>

        {/* 3. Action Buttons */}
        <View style={styles.actionsContainer}>
          <Text style={styles.actionsSectionLabel}>CHOOSE WHERE TO SAVE</Text>

          {/* Option 1: Save to Cards Vault */}
          <TouchableOpacity
            style={styles.saveVaultButton}
            onPress={handleSaveToVault}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Ionicons
              name="albums"
              size={19}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.saveVaultButtonText}>
              {saving ? "Saving..." : "Save to Cards Vault"}
            </Text>
          </TouchableOpacity>

          {/* Option 2: Add to Phone Contacts */}
          <TouchableOpacity
            style={styles.addPhoneButton}
            onPress={handleSaveToContacts}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-add"
              size={19}
              color="#0071E3"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.addPhoneButtonText}>
              {saving ? "Adding..." : "Add to Phone Contacts"}
            </Text>
          </TouchableOpacity>

          {/* Option 3: Save to Both */}
          <TouchableOpacity
            style={styles.saveBothButton}
            onPress={handleSaveToBoth}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkmark-done-circle"
              size={20}
              color="#34C759"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.saveBothButtonText}>Save to Both (Vault & Phone)</Text>
          </TouchableOpacity>

          {/* Retake Button */}
          <TouchableOpacity
            style={styles.retakeSecondaryButton}
            onPress={handleRetake}
            activeOpacity={0.8}
          >
            <Ionicons
              name="camera-outline"
              size={19}
              color="#8E8E93"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.retakeSecondaryButtonText}>Scan Another Card</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Apple HIG "Contact Already Exists" Bottom Sheet Modal */}
      <Modal
        visible={!!duplicateNotice}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDuplicateNotice(null)}
      >
        <View style={styles.dupBackdrop}>
          <TouchableWithoutFeedback onPress={() => setDuplicateNotice(null)}>
            <View style={styles.dupDismissArea} />
          </TouchableWithoutFeedback>

          <View style={styles.dupSheet}>
            {/* Grabber Handle */}
            <View style={styles.dupGrabber}>
              <View style={styles.dupGrabberPill} />
            </View>

            {/* Glowing Icon Badge & Titles */}
            <View style={styles.dupHeader}>
              <View style={styles.dupIconCircle}>
                <Ionicons name="albums" size={26} color="#FFD60A" />
              </View>
              <Text style={styles.dupTitle}>Contact Already Exists</Text>
              <Text style={styles.dupSubtitle}>
                A business card with matching details is already saved in your Cards Vault.
              </Text>
            </View>

            {/* Existing Contact Card Box */}
            {duplicateNotice?.existingCard && (
              <View style={styles.dupCardBox}>
                <View style={styles.dupAvatar}>
                  <Text style={styles.dupAvatarText}>
                    {(duplicateNotice.existingCard.full_name || "C").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.dupCardInfo}>
                  <Text style={styles.dupCardName} numberOfLines={1}>
                    {duplicateNotice.existingCard.full_name || "Existing Contact"}
                  </Text>
                  {!!duplicateNotice.existingCard.company && (
                    <Text style={styles.dupCardCompany} numberOfLines={1}>
                      {duplicateNotice.existingCard.company}
                      {duplicateNotice.existingCard.job_title ? ` • ${duplicateNotice.existingCard.job_title}` : ""}
                    </Text>
                  )}
                  {!!(duplicateNotice.existingCard.email || duplicateNotice.existingCard.phone) && (
                    <Text style={styles.dupCardDetails} numberOfLines={1}>
                      {duplicateNotice.existingCard.email || duplicateNotice.existingCard.phone}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.dupActions}>
              {/* Primary: Update Existing */}
              <TouchableOpacity
                style={styles.dupBtnPrimary}
                onPress={handleConfirmUpdateExisting}
                activeOpacity={0.8}
                disabled={saving}
              >
                <Ionicons name="sync-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.dupBtnPrimaryText}>
                  {saving ? "Updating..." : "Update Existing Contact"}
                </Text>
              </TouchableOpacity>

              {/* Secondary: Save as Duplicate */}
              <TouchableOpacity
                style={styles.dupBtnSecondary}
                onPress={handleConfirmSaveDuplicate}
                activeOpacity={0.8}
                disabled={saving}
              >
                <Ionicons name="copy-outline" size={17} color="#409CFF" style={{ marginRight: 6 }} />
                <Text style={styles.dupBtnSecondaryText}>Save as New Copy Anyway</Text>
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.dupBtnCancel}
                onPress={() => setDuplicateNotice(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.dupBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // -------------------------------------------------------------
  // Camera View Styles
  // -------------------------------------------------------------
  cameraContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#86868B",
    fontSize: 14,
    marginTop: 12,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  permissionCard: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(0, 113, 227, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 113, 227, 0.3)",
  },
  permissionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  permissionSubtitle: {
    color: "#86868B",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  permissionBtnPrimary: {
    backgroundColor: "#0071E3",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  permissionBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  permissionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  permissionBtnSecondaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },

  // 1. Top Controls Bar: Close Button (Left) & Segmented Mode Switcher (Right)
  topControlsRow: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButtonCircular: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  topTitleBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 20, 22, 0.75)",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  topBarTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  // 2. Guide Frame: 100% Mathematically Symmetric & Centered
  guideFrame: {
    position: "absolute",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.65)",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  flashButtonActive: {
    backgroundColor: "rgba(255, 214, 10, 0.25)",
    borderColor: "rgba(255, 214, 10, 0.6)",
  },
  flashActiveCircle: {
    backgroundColor: "rgba(255, 214, 10, 0.22)",
    borderColor: "rgba(255, 214, 10, 0.6)",
  },
  guideSubInstruction: {
    position: "absolute",
    top: "100%",
    marginTop: 14,
    left: -20,
    right: -20,
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  guideInstruction: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 16,
    left: -20,
    right: -20,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  corner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderColor: "#0071E3",
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanningOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 18,
    gap: 8,
  },
  scanningOverlayText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cameraStatusOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 5,
  },
  cameraStatusText: {
    color: "#FFFFFF",
    fontSize: 13,
    marginTop: 10,
    fontWeight: "500",
  },
  cameraFallbackBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 20, 22, 0.9)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  cameraFallbackTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 10,
  },
  cameraFallbackBtn: {
    backgroundColor: "#0071E3",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cameraFallbackBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  // 3. Bottom Controls Bar: Absolute pinned to bottom
  bottomControlsBarAbsolute: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 30,
    zIndex: 20,
  },
  controlIconBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
  },
  controlBtnLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  smartScanIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(48, 209, 88, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(48, 209, 88, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },


  // -------------------------------------------------------------
  // Scan Result Screen Styles (Light Gray Theme)
  // -------------------------------------------------------------
  resultContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  navBackButton: {
    padding: 6,
    width: 40,
    alignItems: "flex-start",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    textAlign: "center",
  },
  navRightPlaceholder: {
    width: 40,
  },
  resultScrollView: {
    flex: 1,
  },
  resultScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Top Summary Card
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1C1C1E",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  summaryRole: {
    fontSize: 15,
    fontWeight: "500",
    color: "#0071E3",
    marginBottom: 10,
  },
  summaryContact: {
    fontSize: 13,
    color: "#3A3A3C",
    marginTop: 2,
  },

  // Second Card with rows and outline icons
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  detailIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0F4FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8E8E93",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailInput: {
    fontSize: 15,
    color: "#1C1C1E",
    fontWeight: "500",
    paddingVertical: 2,
  },
  detailInputSecondary: {
    color: "#0071E3",
    fontWeight: "600",
    marginTop: 4,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5EA",
    marginLeft: 50,
  },

  // Action Buttons
  actionsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  actionsSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    letterSpacing: 0.8,
    marginBottom: 4,
    textAlign: "center",
  },
  saveVaultButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E",
    height: 50,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  saveVaultButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  addPhoneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#0071E3",
  },
  addPhoneButtonText: {
    color: "#0071E3",
    fontSize: 15,
    fontWeight: "600",
  },
  saveBothButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0071E3",
    height: 52,
    borderRadius: 14,
    shadowColor: "#0071E3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBothButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  retakeSecondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E5EA",
    height: 48,
    borderRadius: 14,
    marginTop: 4,
  },
  retakeSecondaryButtonText: {
    color: "#3A3A3C",
    fontSize: 14,
    fontWeight: "600",
  },

  // -------------------------------------------------------------
  // Apple HIG "Contact Already Exists" Bottom Sheet Styles
  // -------------------------------------------------------------
  dupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  dupDismissArea: {
    flex: 1,
  },
  dupSheet: {
    backgroundColor: "#161618",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 38 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  dupGrabber: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
  },
  dupGrabberPill: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  dupHeader: {
    alignItems: "center",
    marginBottom: 18,
  },
  dupIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 214, 10, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 214, 10, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dupTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  dupSubtitle: {
    fontSize: 13,
    color: "#86868B",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  dupCardBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F1F23",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 20,
  },
  dupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dupAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  dupCardInfo: {
    flex: 1,
  },
  dupCardName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dupCardCompany: {
    color: "#86868B",
    fontSize: 12,
    marginTop: 2,
  },
  dupCardDetails: {
    color: "#0A84FF",
    fontSize: 12,
    marginTop: 3,
  },
  dupActions: {
    gap: 10,
  },
  dupBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A84FF",
    height: 50,
    borderRadius: 14,
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  dupBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  dupBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2C2C2E",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  dupBtnSecondaryText: {
    color: "#409CFF",
    fontSize: 14,
    fontWeight: "600",
  },
  dupBtnCancel: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 2,
  },
  dupBtnCancelText: {
    color: "#86868B",
    fontSize: 14,
    fontWeight: "500",
  },
});
