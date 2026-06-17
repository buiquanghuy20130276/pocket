import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image as ExpoImage } from "expo-image";
import { useAuthStore, usePostStore, useCircleStore, useExpenseStore } from "../../src/core/store";
import { useRouter } from "expo-router";
import { THEME, mapIconToIonicons } from "../../src/core/theme";
import { Ionicons } from "@expo/vector-icons";

// -----------------------------------------------
// Category keyword detector
// -----------------------------------------------
interface CategoryRule {
  keywords: string[];
  icon: string;
  label: string;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    keywords: ["ăn", "uống", "cơm", "phở", "bún", "cháo", "bánh", "cafe", "trà", "bia", "coffee", "food", "ăn sáng", "ăn trưa", "ăn tối", "snack", "đồ ăn"],
    icon: "restaurant",
    label: "Ăn uống",
  },
  {
    keywords: ["taxi", "grab", "xe", "xăng", "bus", "xe buýt", "đi", "đường", "phí cầu", "giao thông", "bike", "điện tử", "đi lại"],
    icon: "car",
    label: "Di chuyển",
  },
  {
    keywords: ["mua", "shopping", "quần", "áo", "giày", "túi", "shop", "order", "đặt", "siêu thị", "tạp hoá"],
    icon: "bag-handle",
    label: "Mua sắm",
  },
  {
    keywords: ["thuốc", "bệnh viện", "khám", "y tế", "sức khoẻ", "gym", "thể thao", "fitness", "clinic", "doctor"],
    icon: "heart",
    label: "Sức khoẻ",
  },
  {
    keywords: ["phim", "game", "karaoke", "giải trí", "billiard", "bowling", "nhạc", "concert", "cinema", "netflix"],
    icon: "game-controller",
    label: "Giải trí",
  },
  {
    keywords: ["học", "sách", "khóa", "trường", "học phí", "tài liệu", "giáo dục", "course"],
    icon: "book",
    label: "Giáo dục",
  },
  {
    keywords: ["nhà", "điện", "nước", "internet", "thuê nhà", "sửa", "gas"],
    icon: "home",
    label: "Nhà ở",
  },
  {
    keywords: ["du lịch", "vé", "khách sạn", "hotel", "flight", "travel", "nghỉ", "resort"],
    icon: "airplane",
    label: "Du lịch",
  },
];

function detectCategory(text: string): CategoryRule | null {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule;
    }
  }
  return null;
}

// Parse amount from caption (e.g. "35k", "200.000", "100đ")
function parseAmount(txt: string): number | null {
  // Try patterns: 35k, 35K, 35.000, 35,000, 35000đ, 35000₫, 35k5
  const m = txt.match(/(\d[\d.,]*)[\s]*(k|K|nghìn|đ|₫|VND|vnd|\$)?/);
  if (!m) return null;
  let raw = m[1].replace(/,/g, "");
  let num = parseFloat(raw);
  const unit = m[2];
  if (unit && (unit === "k" || unit === "K" || unit === "nghìn")) num *= 1000;
  if (isNaN(num)) return null;
  return num;
}

const ICON_OPTIONS = [
  { icon: "restaurant", label: "Ăn uống" },
  { icon: "car", label: "Di chuyển" },
  { icon: "bag-handle", label: "Mua sắm" },
  { icon: "heart", label: "Sức khoẻ" },
  { icon: "game-controller", label: "Giải trí" },
  { icon: "book", label: "Giáo dục" },
  { icon: "home", label: "Nhà ở" },
  { icon: "airplane", label: "Du lịch" },
  { icon: "cafe", label: "Cafe" },
  { icon: "barbell", label: "Thể thao" },
  { icon: "paw", label: "Thú cưng" },
  { icon: "gift", label: "Quà tặng" },
];

const COLOR_OPTIONS = [
  "#1D9E75", "#E24B4A", "#378ADD", "#7F77DD",
  "#D97706", "#059669", "#DC2626", "#7C3AED",
];

export default function CameraScreen() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const { myCircle } = useCircleStore();
  const { uploadPost, isLoading } = usePostStore();
  const { categories, addCategory } = useExpenseStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [flash, setFlash] = useState<"off" | "on">("off");

  // Category state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // New category modal state
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("restaurant");
  const [newCatColor, setNewCatColor] = useState(COLOR_OPTIONS[0]);

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !profile) return;
    const success = await addCategory(profile.id, newCatName.trim(), newCatIcon, newCatColor);
    if (success) {
      const addedName = newCatName.trim();
      setNewCatName("");
      setNewCatIcon("restaurant");
      setNewCatColor(COLOR_OPTIONS[0]);
      setShowAddCatModal(false);

      // Auto-select the newly added category
      setTimeout(() => {
        const freshState = useExpenseStore.getState();
        const createdCat = freshState.categories.find(c => c.name === addedName);
        if (createdCat) {
          setSelectedCategoryId(createdCat.id);
        }
      }, 500);
    } else {
      Alert.alert("Lỗi", "Không thể thêm danh mục.");
    }
  };

  const cameraRef = useRef<any>(null);

  // Detect category and amount in realtime from caption
  const detectedRule = detectCategory(caption);
  const detectedAmount = parseAmount(caption);

  // Find matching DB category from detected rule
  const detectedDbCategory = detectedRule
    ? categories.find(c => c.name === detectedRule.label || mapIconToIonicons(c.icon) === detectedRule.icon) || null
    : null;

  const effectiveCategoryId = selectedCategoryId || detectedDbCategory?.id || null;
  const effectiveCategory = selectedCategoryId
    ? categories.find(c => c.id === selectedCategoryId)
    : detectedDbCategory;

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={THEME.textPrimary} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera" size={48} color={THEME.textSecondary} />
        <Text style={styles.permissionText}>Pocket cần quyền truy cập Máy ảnh để chụp hình.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Cấp quyền Máy ảnh</Text>
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
          // Reset caption and category selection on new capture
          setCaption("");
          setSelectedCategoryId(null);
        }
      } catch (err) {
        console.error("Failed to capture photo:", err);
      }
    }
  };

  const handleUpload = async () => {
    if (capturedUri && profile) {
      const circleId = myCircle?.id || null;
      const post = await uploadPost(profile.id, circleId, capturedUri, caption);
      if (post) {
        setCapturedUri(null);
        setCaption("");
        setSelectedCategoryId(null);
        router.back();
      } else {
        const errMsg = usePostStore.getState().errorMessage || "Vui lòng thử lại.";
        Alert.alert("Lỗi gửi bài", `Không thể gửi bài viết: ${errMsg}`);
      }
    }
  };

  const toggleFlash = () => {
    setFlash(prev => prev === "off" ? "on" : "off");
  };

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
              onPress={() => {
                setCapturedUri(null);
                setCaption("");
                setSelectedCategoryId(null);
              }}
            >
              <Ionicons name="arrow-back" size={10} color="#fff" style={{ marginRight: 3 }} />
              <Text style={styles.retakeText}>Chụp lại</Text>
            </TouchableOpacity>

            {/* Detected amount badge */}
            {detectedAmount && (
              <View style={styles.detectedBadge}>
                <Ionicons name="cash-outline" size={9} color={THEME.green.text} style={{ marginRight: 3 }} />
                <Text style={styles.detectedBadgeText}>
                  {detectedAmount.toLocaleString("vi-VN")} ₫
                </Text>
              </View>
            )}
          </View>

          {/* Caption Input */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Ionicons name="pencil" size={12} color={THEME.textTertiary} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.input}
                placeholder="Mô tả chi tiêu (vd: Ăn sáng 35k ☀️)"
                placeholderTextColor={THEME.textTertiary}
                value={caption}
                onChangeText={setCaption}
                autoFocus={true}
              />
            </View>

            {/* Smart Category Row */}
            <View style={styles.categoryRow}>
              <Text style={styles.categoryRowLabel}>Danh mục:</Text>

              {/* Show detected category OR picker state */}
              {effectiveCategory ? (
                <TouchableOpacity
                  style={[
                    styles.categoryBadge,
                    selectedCategoryId ? styles.categoryBadgeManual : styles.categoryBadgeAuto,
                  ]}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Ionicons
                    name={mapIconToIonicons(effectiveCategory.icon) as any}
                    size={9}
                    color={selectedCategoryId ? THEME.textPrimary : THEME.green.text}
                    style={{ marginRight: 3 }}
                  />
                  <Text style={[styles.categoryBadgeText, selectedCategoryId && { color: THEME.textPrimary }]}>
                    {effectiveCategory.name}
                  </Text>
                  {!selectedCategoryId && (
                    <Text style={styles.autoTag}> ✦ auto</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.categoryPickerBtn}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Ionicons name="add" size={10} color={THEME.textTertiary} style={{ marginRight: 3 }} />
                  <Text style={styles.categoryPickerBtnText}>Chọn danh mục</Text>
                </TouchableOpacity>
              )}

              {effectiveCategoryId && (
                <TouchableOpacity
                  style={styles.clearCatBtn}
                  onPress={() => setSelectedCategoryId(null)}
                >
                  <Ionicons name="close-circle" size={14} color={THEME.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category picker dropdown */}
            {showCategoryPicker && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catPickerRow}
                contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
              >
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catPickerChip,
                      effectiveCategoryId === cat.id && styles.catPickerChipActive,
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Ionicons
                      name={mapIconToIonicons(cat.icon) as any}
                      size={10}
                      color={effectiveCategoryId === cat.id ? THEME.buttonText : THEME.textPrimary}
                    />
                    <Text style={[
                      styles.catPickerChipText,
                      effectiveCategoryId === cat.id && { color: THEME.buttonText },
                    ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* "+" Add category button */}
                <TouchableOpacity
                  style={[
                    styles.catPickerChip,
                    {
                      backgroundColor: THEME.backgroundSecondary,
                      borderStyle: "dashed",
                      borderWidth: 1,
                      borderColor: THEME.borderPrimary,
                    },
                  ]}
                  onPress={() => setShowAddCatModal(true)}
                >
                  <Ionicons name="add" size={10} color={THEME.textSecondary} />
                  <Text style={[styles.catPickerChipText, { color: THEME.textSecondary }]}>
                    Thêm danh mục
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}

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
            <CameraView style={styles.viewfinder} ref={cameraRef} flash={flash} />
            <View style={[StyleSheet.absoluteFillObject, { justifyContent: "center", alignItems: "center" }]} pointerEvents="box-none">
              {/* Focus Ring Indicator overlay */}
              <View style={styles.focusRing} />

              {/* Flash control top right */}
              <TouchableOpacity style={styles.iconCircleOverlayRight} onPress={toggleFlash}>
                <Ionicons name={flash === "on" ? "flash" : "flash-off"} size={13} color="#fff" />
              </TouchableOpacity>

              {/* Close button top left */}
              <TouchableOpacity style={styles.iconCircleOverlayLeft} onPress={() => router.back()}>
                <Ionicons name="close" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Controls */}
          <View style={styles.shutterRow}>
            {/* Gallery placeholder */}
            <TouchableOpacity style={styles.galleryPlaceholder}>
              <Ionicons name="image" size={22} color={THEME.textTertiary} />
            </TouchableOpacity>

            {/* Shutter Circle Button */}
            <TouchableOpacity style={styles.shutterOuter} onPress={handleCapture}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>

            <View style={{ width: 44 }} />
          </View>
        </View>
      )}

      {/* Add Category Modal */}
      <Modal
        visible={showAddCatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCatModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowAddCatModal(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Thêm danh mục</Text>

              <Text style={styles.modalLabel}>Tên danh mục</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ví dụ: Cafe, Du lịch..."
                placeholderTextColor={THEME.textTertiary}
                value={newCatName}
                onChangeText={setNewCatName}
                autoFocus
              />

              <Text style={styles.modalLabel}>Chọn biểu tượng</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
                {ICON_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.icon}
                    style={[styles.iconOption, newCatIcon === opt.icon && { borderColor: THEME.textPrimary, borderWidth: 1.5 }]}
                    onPress={() => setNewCatIcon(opt.icon)}
                  >
                    <Ionicons name={opt.icon as any} size={16} color={THEME.textPrimary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Màu sắc</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, newCatColor === c && styles.colorDotSelected]}
                    onPress={() => setNewCatColor(c)}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalSaveBtn, !newCatName.trim() && { opacity: 0.5 }]}
                onPress={handleAddCategory}
                disabled={!newCatName.trim()}
              >
                <Text style={styles.modalSaveBtnText}>Thêm danh mục</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
    fontSize: 16,
    textAlign: "center",
  },
  viewfinderContainer: {
    flex: 1,
    backgroundColor: "#111",
    paddingBottom: 24,
  },
  statusShim: {
    height: Platform.OS === "ios" ? 44 : 20,
  },
  cameraFrame: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  viewfinder: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  focusRing: {
    width: 44,
    height: 44,
    borderWidth: 1.5,
    borderColor: "rgba(255, 220, 0, 0.8)",
    borderRadius: 6,
  },
  iconCircleOverlayLeft: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircleOverlayRight: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingVertical: 24,
  },
  galleryPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#222",
    borderWidth: 0.5,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
  },
  scrollContent: {
    paddingTop: Platform.OS === "ios" ? 44 : 20,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  viewfinderFrame: {
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: "hidden",
    aspectRatio: 1,
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
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  retakeText: {
    color: "#fff",
    fontSize: 13,
  },
  detectedBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  detectedBadgeText: {
    color: THEME.green.text,
    fontSize: 13,
    fontWeight: "600",
  },
  formContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: THEME.textPrimary,
    padding: 0,
  },

  // Category row
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  categoryRowLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryBadgeAuto: {
    backgroundColor: THEME.green.bg,
  },
  categoryBadgeManual: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
  },
  categoryBadgeText: {
    color: THEME.green.text,
    fontSize: 13,
    fontWeight: "600",
  },
  autoTag: {
    fontSize: 11,
    color: THEME.green.text,
    opacity: 0.7,
  },
  categoryPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryPickerBtnText: {
    fontSize: 13,
    color: THEME.textTertiary,
  },
  clearCatBtn: {
    marginLeft: "auto" as any,
  },
  catPickerRow: {
    marginBottom: 16,
  },
  catPickerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
  },
  catPickerChipActive: {
    backgroundColor: THEME.buttonPrimary,
    borderColor: THEME.buttonPrimary,
  },
  catPickerChipText: {
    fontSize: 13,
    color: THEME.textPrimary,
  },

  primaryBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: THEME.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalSheet: {
    backgroundColor: THEME.backgroundPrimary,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.borderSecondary,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 12,
    color: THEME.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.textPrimary,
    marginBottom: 20,
  },
  iconRow: {
    marginBottom: 20,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  colorRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    borderWidth: 2.5,
    borderColor: THEME.textPrimary,
  },
  modalSaveBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalSaveBtnText: {
    color: THEME.buttonText,
    fontSize: 15,
    fontWeight: "600",
  },
});
