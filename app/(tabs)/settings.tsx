import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image as ExpoImage } from "expo-image";
import { useAuthStore, useExpenseStore, useCircleStore, usePostStore } from "../../src/core/store";
import { THEME, mapIconToIonicons } from "../../src/core/theme";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/core/supabaseClient";
import * as Clipboard from "expo-clipboard";

// -----------------------------------------------
// Icon options for new category
// -----------------------------------------------
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

// -----------------------------------------------
// Category icon map (maps icon name -> bg color)
// -----------------------------------------------
const CAT_PALETTE: Record<string, { bg: string; color: string }> = {
  restaurant: { bg: "#E1F5EE", color: "#0F6E56" },
  car: { bg: "#FAEEDA", color: "#854F0B" },
  "bag-handle": { bg: "#EEEDFE", color: "#534AB7" },
  heart: { bg: "#FCEBEB", color: "#A32D2D" },
  "game-controller": { bg: "#E6F1FB", color: "#185FA5" },
  book: { bg: "#FEF9C3", color: "#854D0E" },
  home: { bg: "#F0FDF4", color: "#166534" },
  airplane: { bg: "#EFF6FF", color: "#1D4ED8" },
  cafe: { bg: "#FDF2F8", color: "#9D174D" },
  barbell: { bg: "#ECFDF5", color: "#065F46" },
  paw: { bg: "#FFF7ED", color: "#C2410C" },
  gift: { bg: "#F5F3FF", color: "#6D28D9" },
};

const getPalette = (icon: string | null, color: string | null) => {
  const mappedIcon = mapIconToIonicons(icon);
  if (mappedIcon && CAT_PALETTE[mappedIcon]) return CAT_PALETTE[mappedIcon];
  return { bg: color ? color + "22" : "#E1F5EE", color: color || "#0F6E56" };
};

export default function SettingsScreen() {
  const { profile, signOut, updateProfile, isLoading: authLoading } = useAuthStore();
  const { totalBudget, expenses, totalSpent, categories, fetchDashboardData, addCategory, deleteCategory } = useExpenseStore();
  const { myCircle, members, createCircle, joinCircle, fetchMyCircle } = useCircleStore();
  const { posts, fetchPosts } = usePostStore();

  // Navigation state within settings tab
  const [screen, setScreen] = useState<"profile" | "edit_profile" | "settings" | "categories" | "privacy">("profile");

  const [newCircleName, setNewCircleName] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");

  // Edit profile state
  const [editDisplayName, setEditDisplayName] = useState(profile?.display_name || "");
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // New category modal state
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("restaurant");
  const [newCatColor, setNewCatColor] = useState(COLOR_OPTIONS[0]);

  // Notifications
  const [newPostsToggle, setNewPostsToggle] = useState(true);
  const [expenseLoggedToggle, setExpenseLoggedToggle] = useState(true);
  const [budgetAlertsToggle, setBudgetAlertsToggle] = useState(false);

  const [editBudget, setEditBudget] = useState(String(totalBudget));

  useEffect(() => {
    if (profile) {
      fetchMyCircle(profile.id);
      fetchDashboardData(profile.id);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      fetchPosts(myCircle?.id || null, profile.id);
    }
  }, [profile, myCircle]);

  useEffect(() => {
    setEditDisplayName(profile?.display_name || "");
  }, [profile]);

  useEffect(() => {
    setEditBudget(String(totalBudget));
  }, [totalBudget]);

  const handleCreateCircle = async () => {
    if (newCircleName.trim() && profile) {
      const success = await createCircle(profile.id, newCircleName.trim());
      if (success) {
        setNewCircleName("");
        Alert.alert("Thành công", `Đã tạo nhóm: ${newCircleName}`);
      }
    }
  };

  const handleJoinCircle = async () => {
    if (joinInviteCode.trim() && profile) {
      const success = await joinCircle(profile.id, joinInviteCode.trim());
      if (success) {
        setJoinInviteCode("");
        Alert.alert("Thành công", "Đã tham gia nhóm thành công!");
      } else {
        Alert.alert("Thất bại", "Không thể tìm thấy hoặc tham gia nhóm với mã này.");
      }
    }
  };

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const handleSaveBudget = async () => {
    if (profile) {
      const parsed = parseFloat(editBudget);
      if (parsed > 0) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const dateStr = startOfMonth.toISOString().split("T")[0];

        const { error } = await supabase
          .from("budget_periods")
          .upsert({
            user_id: profile.id,
            period_start: dateStr,
            period_end: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).toISOString().split("T")[0],
            total_budget: Math.round(parsed),
            currency: "VND",
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id,period_start" });

        if (!error) {
          await fetchDashboardData(profile.id);
          Alert.alert("Thành công", "Đã lưu cài đặt ngân sách.");
        }
      }
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarLocalUri(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const success = await updateProfile(editDisplayName, avatarLocalUri);
    setIsSavingProfile(false);
    if (success) {
      setAvatarLocalUri(null);
      Alert.alert("Thành công", "Hồ sơ đã được cập nhật.");
      setScreen("profile");
    } else {
      Alert.alert("Lỗi", "Không thể lưu hồ sơ, vui lòng thử lại.");
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !profile) return;
    const success = await addCategory(profile.id, newCatName.trim(), newCatIcon, newCatColor);
    if (success) {
      setNewCatName("");
      setNewCatIcon("restaurant");
      setNewCatColor(COLOR_OPTIONS[0]);
      setShowAddCatModal(false);
    } else {
      Alert.alert("Lỗi", "Không thể thêm danh mục.");
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert("Xoá danh mục", `Bạn có muốn xoá danh mục "${name}" không?`, [
      { text: "Hủy", style: "cancel" },
      { text: "Xoá", style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  };

  const handleCopyInviteCode = async () => {
    if (myCircle?.invite_code) {
      try {
        await Clipboard.setStringAsync(myCircle.invite_code);
        Alert.alert("Sao chép", "Đã sao chép mã mời vào bộ nhớ tạm.");
      } catch {
        Alert.alert("Mã mời", myCircle.invite_code);
      }
    }
  };

  const ratio = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // -----------------------------------------------
  // AVATAR display helper
  // -----------------------------------------------
  const avatarSrc = avatarLocalUri || profile?.avatar_url;
  const avatarInitial = (profile?.display_name || profile?.username || "M").substring(0, 1).toUpperCase();

  return (
    <View style={styles.container}>

      {/* ===== SCREEN: PROFILE ===== */}
      {screen === "profile" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Hồ sơ</Text>
            <TouchableOpacity onPress={() => setScreen("settings")}>
              <Ionicons name="settings-outline" size={18} color={THEME.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Avatar & name */}
          <View style={styles.profileBox}>
            <TouchableOpacity style={styles.avatarBig} onPress={() => setScreen("edit_profile")}>
              {avatarSrc ? (
                <ExpoImage
                  source={{ uri: avatarSrc }}
                  style={styles.avatarBigImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarBigText}>{avatarInitial}</Text>
              )}
              <View style={styles.editAvatarBadge}>
                <Ionicons name="pencil" size={8} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.nameCenter}>
              <Text style={styles.profileName}>{profile?.display_name || "Tôi"}</Text>
              <Text style={styles.profileSub}>
                @{profile?.username}
              </Text>
            </View>

            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setScreen("edit_profile")}>
              <Ionicons name="create-outline" size={11} color={THEME.textSecondary} />
              <Text style={styles.editProfileBtnText}>Chỉnh sửa hồ sơ</Text>
            </TouchableOpacity>
          </View>

          {/* Stats grid card */}
          <View style={styles.statsCardGrid}>
            <View style={styles.statsCol}>
              <Text style={styles.statsValText}>{posts.length}</Text>
              <Text style={styles.statsSubText}>Nhật ký</Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.statsValText}>
                {totalBudget >= 1000000 ? `${(totalBudget / 1000000).toFixed(0)}tr` : totalBudget.toLocaleString("vi-VN")}
              </Text>
              <Text style={styles.statsSubText}>Hạn mức ví</Text>
            </View>
            <View style={styles.statsColGreen}>
              <Text style={styles.statsValTextGreen}>{Math.round(ratio)}%</Text>
              <Text style={styles.statsSubTextGreen}>Đã dùng</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color={THEME.textSecondary} />
            <Text style={styles.infoCardText}>
              Pocket đang hoạt động ở chế độ cá nhân. Bạn có thể chụp ảnh khoảnh khắc và ghi nhận chi tiêu hàng ngày một cách trực quan, nhanh chóng.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ===== SCREEN: EDIT PROFILE ===== */}
      {screen === "edit_profile" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBack} onPress={() => setScreen("profile")}>
              <Ionicons name="arrow-back" size={16} color={THEME.textSecondary} />
              <Text style={styles.headerBackText}>Chỉnh sửa hồ sơ</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar picker */}
          <View style={styles.editAvatarSection}>
            <TouchableOpacity style={styles.editAvatarCircle} onPress={handlePickAvatar}>
              {avatarSrc ? (
                <ExpoImage source={{ uri: avatarSrc }} style={styles.editAvatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.editAvatarInitial}>{avatarInitial}</Text>
              )}
              <View style={styles.editAvatarOverlay}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.editAvatarHint}>Chạm để thay đổi ảnh đại diện</Text>
          </View>

          {/* Display name */}
          <View style={styles.editFormCard}>
            <Text style={styles.editFieldLabel}>Tên hiển thị</Text>
            <TextInput
              style={styles.editFieldInput}
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder="Nhập tên hiển thị"
              placeholderTextColor={THEME.textTertiary}
            />
          </View>

          {/* Username (read-only) */}
          <View style={styles.editFormCard}>
            <Text style={styles.editFieldLabel}>Tên người dùng</Text>
            <View style={styles.editFieldReadOnly}>
              <Text style={styles.editFieldReadOnlyText}>@{profile?.username}</Text>
              <Text style={styles.editFieldReadOnlyHint}>Không thể thay đổi</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveProfileBtn, isSavingProfile && { opacity: 0.6 }]}
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveProfileBtnText}>Lưu thay đổi</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ===== SCREEN: SETTINGS ===== */}
      {screen === "settings" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBack} onPress={() => setScreen("profile")}>
              <Ionicons name="arrow-back" size={16} color={THEME.textSecondary} />
              <Text style={styles.headerBackText}>Cài đặt</Text>
            </TouchableOpacity>
          </View>

          {/* BUDGET Section */}
          <Text style={styles.settingsSectionHeader}>CÀI ĐẶT NGÂN SÁCH</Text>
          <View style={styles.settingsFormCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="wallet-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Ngân sách hàng tháng</Text>
              </View>
              <TextInput
                style={styles.rowInput}
                value={editBudget}
                onChangeText={setEditBudget}
                onBlur={handleSaveBudget}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.row} onPress={() => setScreen("categories")}>
              <View style={styles.rowLeft}>
                <Ionicons name="pricetag-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Danh mục chi tiêu</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={THEME.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="cash-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Tiền tệ</Text>
              </View>
              <Text style={styles.rowValueText}>VND</Text>
            </View>
          </View>

          {/* NOTIFICATIONS Section */}
          <Text style={styles.settingsSectionHeader}>THÔNG BÁO</Text>
          <View style={styles.settingsFormCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="card-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Khi có chi tiêu mới</Text>
              </View>
              <Switch
                value={expenseLoggedToggle}
                onValueChange={setExpenseLoggedToggle}
                trackColor={{ false: THEME.borderSecondary, true: "#2C2C2A" }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="alert-circle-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Cảnh báo hạn mức ví</Text>
              </View>
              <Switch
                value={budgetAlertsToggle}
                onValueChange={setBudgetAlertsToggle}
                trackColor={{ false: THEME.borderSecondary, true: "#2C2C2A" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* ACCOUNT Section */}
          <Text style={styles.settingsSectionHeader}>TÀI KHOẢN</Text>
          <View style={styles.settingsFormCard}>
            <TouchableOpacity style={styles.row} onPress={() => setScreen("privacy")}>
              <View style={styles.rowLeft}>
                <Ionicons name="shield-checkmark-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Quyền riêng tư</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={THEME.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleLogout}>
              <View style={styles.rowLeft}>
                <Ionicons name="log-out-outline" size={13} color="#E24B4A" />
                <Text style={[styles.rowLabelText, { color: "#E24B4A" }]}>Đăng xuất</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ===== SCREEN: CATEGORIES (from DB) ===== */}
      {screen === "categories" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBack} onPress={() => setScreen("settings")}>
              <Ionicons name="arrow-back" size={16} color={THEME.textSecondary} />
              <Text style={styles.headerBackText}>Danh mục chi tiêu</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddCatModal(true)}>
              <Ionicons name="add" size={20} color={THEME.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesListBlock}>
            {categories.length === 0 && (
              <View style={styles.emptyCat}>
                <Ionicons name="pricetag-outline" size={28} color={THEME.textTertiary} />
                <Text style={styles.emptyCatText}>Chưa có danh mục nào</Text>
                <Text style={styles.emptyCatSub}>Nhấn + để thêm danh mục</Text>
              </View>
            )}
            {categories.map(cat => {
              const palette = getPalette(cat.icon, cat.color);
              // Calculate spending in this category this month
              const startM = new Date();
              startM.setDate(1);
              startM.setHours(0, 0, 0, 0);
              const catSpent = expenses
                .filter(e => e.category_id === cat.id && new Date(e.expense_date) >= startM)
                .reduce((sum, e) => sum + e.amount, 0);
              const limit = cat.budget_limit || 0;
              const pct = limit > 0 ? Math.min((catSpent / limit) * 100, 100) : 0;
              const overBudget = limit > 0 && catSpent > limit;
              const barColor = overBudget ? "#E24B4A" : palette.color;

              return (
                <View key={cat.id} style={styles.catBudgetRow}>
                  <View style={[styles.catIconCircle, { backgroundColor: palette.bg }]}>
                    <Ionicons name={mapIconToIonicons(cat.icon) as any} size={12} color={palette.color} />
                  </View>
                  <View style={styles.catBudgetContent}>
                    <Text style={styles.catNameText}>{cat.name}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[styles.catSpentText, overBudget && { color: "#E24B4A" }]}>
                      {catSpent.toLocaleString("vi-VN")} ₫ {limit > 0 ? `/ ${limit.toLocaleString("vi-VN")} ₫` : ""}
                    </Text>
                  </View>
                  {!cat.is_default && (
                    <TouchableOpacity
                      style={styles.deleteCatBtn}
                      onPress={() => handleDeleteCategory(cat.id, cat.name)}
                    >
                      <Ionicons name="trash-outline" size={12} color="#E24B4A" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

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
                <Pressable style={styles.modalSheet} onPress={() => { }}>
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
        </ScrollView>
      )}

      {/* ===== SCREEN: PRIVACY ===== */}
      {screen === "privacy" && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBack} onPress={() => setScreen("settings")}>
              <Ionicons name="arrow-back" size={16} color={THEME.textSecondary} />
              <Text style={styles.headerBackText}>Quyền riêng tư</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.settingsSectionHeader}>HIỂN THỊ HỒ SƠ</Text>
          <View style={styles.settingsFormCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="eye-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Hiển thị tên thật</Text>
              </View>
              <Switch
                value={true}
                trackColor={{ false: THEME.borderSecondary, true: "#2C2C2A" }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="person-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Cho phép tìm kiếm theo username</Text>
              </View>
              <Switch
                value={true}
                trackColor={{ false: THEME.borderSecondary, true: "#2C2C2A" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <Text style={styles.settingsSectionHeader}>DỮ LIỆU CHI TIÊU</Text>
          <View style={styles.settingsFormCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="bar-chart-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Chia sẻ thống kê với nhóm</Text>
              </View>
              <Switch
                value={false}
                trackColor={{ false: THEME.borderSecondary, true: "#2C2C2A" }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="cash-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Ẩn số tiền trong bài viết</Text>
              </View>
              <Switch
                value={false}
                trackColor={{ false: THEME.borderSecondary, true: "#2C2C2A" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <Text style={styles.settingsSectionHeader}>DỮ LIỆU VÀ BẢO MẬT</Text>
          <View style={styles.settingsFormCard}>
            <TouchableOpacity style={styles.row} onPress={() => Alert.alert("Xoá dữ liệu", "Tính năng này sẽ sớm được cập nhật.")}>
              <View style={styles.rowLeft}>
                <Ionicons name="trash-outline" size={13} color="#E24B4A" />
                <Text style={[styles.rowLabelText, { color: "#E24B4A" }]}>Xoá toàn bộ dữ liệu chi tiêu</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={THEME.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => Alert.alert("Xoá tài khoản", "Vui lòng liên hệ hỗ trợ để xoá tài khoản.")}>
              <View style={styles.rowLeft}>
                <Ionicons name="person-remove-outline" size={13} color="#E24B4A" />
                <Text style={[styles.rowLabelText, { color: "#E24B4A" }]}>Xoá tài khoản</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={THEME.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.privacyInfoCard}>
            <Ionicons name="lock-closed-outline" size={14} color={THEME.textSecondary} />
            <Text style={styles.privacyInfoText}>
              Dữ liệu của bạn được lưu trữ bảo mật và không bao giờ được bán cho bên thứ ba.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
    paddingTop: Platform.OS === "ios" ? 44 : 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBackText: {
    fontSize: 18,
    fontWeight: "600",
    color: THEME.textPrimary,
  },

  // Profile screen
  profileBox: {
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  avatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E1F5EE",
    borderWidth: 2,
    borderColor: "#9FE1CB",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  avatarBigImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarBigText: {
    fontSize: 26,
    fontWeight: "500",
    color: "#0F6E56",
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#2C2C2A",
    justifyContent: "center",
    alignItems: "center",
  },
  nameCenter: {
    alignItems: "center",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  profileSub: {
    fontSize: 13,
    color: THEME.textTertiary,
    marginTop: 4,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editProfileBtnText: {
    fontSize: 13,
    color: THEME.textSecondary,
  },

  // Edit profile screen
  editAvatarSection: {
    alignItems: "center",
    marginVertical: 24,
    gap: 10,
  },
  editAvatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E1F5EE",
    borderWidth: 2,
    borderColor: "#9FE1CB",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  editAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarInitial: {
    fontSize: 32,
    fontWeight: "500",
    color: "#0F6E56",
  },
  editAvatarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  editAvatarHint: {
    fontSize: 12,
    color: THEME.textTertiary,
  },
  editFormCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  editFieldLabel: {
    fontSize: 12,
    color: THEME.textTertiary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editFieldInput: {
    fontSize: 16,
    color: THEME.textPrimary,
    padding: 0,
  },
  editFieldReadOnly: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editFieldReadOnlyText: {
    fontSize: 16,
    color: THEME.textSecondary,
  },
  editFieldReadOnlyHint: {
    fontSize: 12,
    color: THEME.textTertiary,
  },
  saveProfileBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    alignItems: "center",
  },
  saveProfileBtnText: {
    color: THEME.buttonText,
    fontSize: 16,
    fontWeight: "600",
  },

  // Stats
  statsCardGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statsCol: {
    flex: 1,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  statsColGreen: {
    flex: 1,
    backgroundColor: "#E1F5EE",
    borderWidth: 0.5,
    borderColor: "#9FE1CB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  statsValText: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  statsSubText: {
    fontSize: 12,
    color: THEME.textTertiary,
    marginTop: 4,
  },
  statsValTextGreen: {
    fontSize: 16,
    fontWeight: "700",
    color: "#085041",
  },
  statsSubTextGreen: {
    fontSize: 12,
    color: "#1D9E75",
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
  },
  settingsSectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textTertiary,
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  settingsFormCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    marginHorizontal: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.borderSecondary,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabelText: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  rowInput: {
    fontSize: 14,
    color: THEME.textSecondary,
    padding: 0,
    textAlign: "right",
    width: 120,
  },
  rowValueText: {
    fontSize: 14,
    color: THEME.textSecondary,
  },

  // Categories
  categoriesListBlock: {
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  catBudgetRow: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  catBudgetContent: {
    flex: 1,
  },
  catNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  catSpentText: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: THEME.borderSecondary,
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  deleteCatBtn: {
    padding: 6,
  },
  emptyCat: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 40,
  },
  emptyCatText: {
    fontSize: 15,
    color: THEME.textSecondary,
    fontWeight: "600",
  },
  emptyCatSub: {
    fontSize: 13,
    color: THEME.textTertiary,
  },

  // Circle (legacy/fallback if referenced)
  circleSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  circleCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  circleHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  circleNameLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: THEME.textPrimary,
  },
  circleInviteLabel: {
    fontSize: 12,
    color: THEME.textTertiary,
  },
  avatarListRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  memberAvatarCol: {
    alignItems: "center",
    gap: 4,
    width: 48,
  },
  avatarMiniSettings: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
    overflow: "hidden",
  },
  avatarMiniImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarMiniTextSettings: {
    fontSize: 12,
    fontWeight: "bold",
  },
  memberNameSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    textAlign: "center",
    width: "100%",
  },
  inviteCard: {
    backgroundColor: "#F1EFE8",
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inviteTextColumn: { flex: 1 },
  inviteCardSub: { fontSize: 11, color: "#5F5E5A", marginBottom: 2 },
  inviteCardCode: { fontSize: 15, fontWeight: "bold", color: "#2C2C2A", letterSpacing: 1 },
  inviteActionsRow: { flexDirection: "row", gap: 6 },
  inviteBtnIcon: {
    backgroundColor: "#D3D1C7",
    borderRadius: 8,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  inviteBtnShare: {
    backgroundColor: "#2C2C2A",
    borderRadius: 8,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  noCircleCard: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  circleSectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.textTertiary,
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  actionCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    padding: 12,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  inlineForm: { flexDirection: "row", gap: 8 },
  inlineInput: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    color: THEME.textPrimary,
  },
  inlineBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  inlineBtnText: {
    color: THEME.buttonText,
    fontSize: 13,
    fontWeight: "bold",
  },

  // Privacy screen
  privacyInfoCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  privacyInfoText: {
    flex: 1,
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 18,
  },

  // Add category modal
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
