import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ExpoImage } from "expo-image";
import { useAuthStore, usePostStore } from "../../src/core/store";
import { useRouter } from "expo-router";
import { THEME } from "../../src/core/theme";
import { Ionicons } from "@expo/vector-icons";

export default function CameraScreen() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const { uploadPost, isLoading } = usePostStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [flash, setFlash] = useState<"off" | "on">("off");

  const cameraRef = useRef<any>(null);

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={THEME.textPrimary} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera" size={48} color={THEME.textSecondary} />
        <Text style={styles.permissionText}>SnapLedger needs Camera permissions to take photos.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        });
        if (photo && photo.uri) {
          setCapturedUri(photo.uri);
          setCaption("Ăn sáng 10k ☀️");
        }
      } catch (err) {
        console.error("Failed to capture photo:", err);
      }
    }
  };

  const handleUpload = async () => {
    if (capturedUri && profile) {
      const post = await uploadPost(profile.id, capturedUri, caption);
      if (post) {
        setCapturedUri(null);
        setCaption("");
        router.back();
      }
    }
  };

  const toggleFlash = () => {
    setFlash(prev => prev === "off" ? "on" : "off");
  };

  const extractAmountFromCaption = (txt: string): string => {
    const match = txt.match(/(\d[\d.,]*)\s*(k|K|nghìn|đ|₫|vnd|VND|\$)?/);
    if (match) return match[0] + " detected";
    return "";
  };

  const detectedAmount = extractAmountFromCaption(caption);

  return (
    <View style={styles.container}>
      {capturedUri ? (
        // Preview & Caption creation Screen
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Gửi khoảnh khắc</Text>
          </View>

          {/* Photo frame */}
          <View style={styles.viewfinderFrame}>
            <ExpoImage
              source={{ uri: capturedUri }}
              style={styles.image}
              contentFit="cover"
            />
            {/* Retake overlay button */}
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setCapturedUri(null)}
            >
              <Ionicons name="arrow-back" size={10} color="#fff" style={{ marginRight: 3 }} />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>

            {/* Detected expense badge */}
            {detectedAmount && (
              <View style={styles.detectedBadge}>
                <Ionicons name="logo-usd" size={9} color={THEME.green.text} style={{ marginRight: 3 }} />
                <Text style={styles.detectedBadgeText}>{detectedAmount}</Text>
              </View>
            )}
          </View>

          {/* Caption Input Section */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Ionicons name="pencil" size={12} color={THEME.textTertiary} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.input}
                placeholder="Ăn sáng 10k ☀️"
                placeholderTextColor={THEME.textTertiary}
                value={caption}
                onChangeText={setCaption}
                autoFocus={true}
              />
            </View>

            {/* Auto-detected Category info */}
            <View style={styles.categoryInfoRow}>
              <View style={styles.categoryBadge}>
                <Ionicons name="restaurant" size={9} color={THEME.green.text} style={{ marginRight: 3 }} />
                <Text style={styles.categoryBadgeText}>Food & Drink</Text>
              </View>
              <Text style={styles.autoDetectSub}>auto-detected</Text>
              <TouchableOpacity style={{ marginLeft: "auto" }}>
                <Ionicons name="pencil" size={10} color={THEME.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Send Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleUpload}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={THEME.buttonText} />
              ) : (
                <>
                  <Ionicons name="send" size={12} color={THEME.buttonText} style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Gửi khoảnh khắc</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        // Camera Viewfinder Screen
        <View style={styles.viewfinderContainer}>
          <View style={styles.statusShim} />
          
          <View style={styles.cameraFrame}>
            <CameraView style={styles.viewfinder} ref={cameraRef} flash={flash}>
              {/* Focus Ring Indicator overlay */}
              <View style={styles.focusRing} />
              
              {/* Flash control top right */}
              <TouchableOpacity style={styles.iconCircleOverlayRight} onPress={toggleFlash}>
                <Ionicons name={flash === "on" ? "flash" : "flash-off"} size={13} color="#fff" />
              </TouchableOpacity>

              {/* Back flip control top left */}
              <TouchableOpacity style={styles.iconCircleOverlayLeft} onPress={() => router.back()}>
                <Ionicons name="close" size={13} color="#fff" />
              </TouchableOpacity>
            </CameraView>
          </View>

          {/* Bottom Controls */}
          <View style={styles.shutterRow}>
            {/* Gallery placeholder */}
            <TouchableOpacity style={styles.galleryPlaceholder}>
              <Ionicons name="image" size={16} color={THEME.textTertiary} />
            </TouchableOpacity>

            {/* Shutter Circle Button */}
            <TouchableOpacity style={styles.shutterOuter} onPress={handleCapture}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <View style={{ width: 32 }} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 20,
    backgroundColor: THEME.backgroundPrimary,
  },
  permissionText: {
    color: THEME.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  viewfinderContainer: {
    flex: 1,
    backgroundColor: "#111",
    paddingBottom: 20,
  },
  statusShim: {
    height: Platform.OS === "ios" ? 44 : 20,
  },
  cameraFrame: {
    marginHorizontal: 10,
    borderRadius: 24,
    overflow: "hidden",
    aspectRatio: 0.85,
    backgroundColor: "#1a1a1a",
  },
  viewfinder: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  focusRing: {
    width: 36,
    height: 36,
    borderWidth: 1.5,
    borderColor: "rgba(255, 220, 0, 0.8)",
    borderRadius: 4,
  },
  iconCircleOverlayLeft: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircleOverlayRight: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  galleryPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#222",
    borderWidth: 0.5,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  scrollContent: {
    paddingTop: Platform.OS === "ios" ? 44 : 20,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  viewfinderFrame: {
    marginHorizontal: 10,
    borderRadius: 20,
    overflow: "hidden",
    aspectRatio: 1.05,
    backgroundColor: THEME.backgroundSecondary,
    position: "relative",
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  retakeBtn: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  retakeText: {
    color: "#fff",
    fontSize: 9,
  },
  detectedBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  detectedBadgeText: {
    color: THEME.green.text,
    fontSize: 9,
    fontWeight: "600",
  },
  formContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 11,
    color: THEME.textPrimary,
    padding: 0,
  },
  categoryInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: THEME.green.bg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryBadgeText: {
    color: THEME.green.text,
    fontSize: 9,
    fontWeight: "600",
  },
  autoDetectSub: {
    fontSize: 9,
    color: THEME.textTertiary,
  },
  primaryBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: THEME.buttonText,
    fontSize: 12,
    fontWeight: "600",
  },
});
