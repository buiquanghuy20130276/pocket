import React, { useState } from "react";
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
} from "react-native";
import { useAuthStore, useExpenseStore } from "../../src/core/store";
import { THEME } from "../../src/core/theme";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/core/supabaseClient";

export default function SettingsScreen() {
  const { profile, signOut, saveProfile } = useAuthStore();
  const { totalBudget, expenses, totalSpent, fetchDashboardData } = useExpenseStore();

  // Navigation state within settings tab
  const [screen, setScreen] = useState<"profile" | "settings" | "categories">("profile");

  // On/Off Toggles for Settings
  const [newPostsToggle, setNewPostsToggle] = useState(true);
  const [expenseLoggedToggle, setExpenseLoggedToggle] = useState(true);
  const [budgetAlertsToggle, setBudgetAlertsToggle] = useState(false);

  // Edit fields
  const [editBudget, setEditBudget] = useState(String(totalBudget));

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

  const ratio = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <View style={styles.container}>
      {screen === "profile" && (
        // =============================================
        // SCREEN 1: PROFILE VIEW (PERSONAL MODE)
        // =============================================
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity onPress={() => setScreen("settings")}>
              <Ionicons name="settings-outline" size={18} color={THEME.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Avatar & name */}
          <View style={styles.profileBox}>
            <View style={styles.avatarBig}>
              <Text style={styles.avatarBigText}>
                {(profile?.display_name || profile?.username || "M").substring(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.nameCenter}>
              <Text style={styles.profileName}>{profile?.display_name || "Nguyen Van Minh"}</Text>
              <Text style={styles.profileSub}>@{profile?.username} · Cá nhân</Text>
            </View>
          </View>

          {/* Stats grid card (Posts, Budget Limit, Budget used) */}
          <View style={styles.statsCardGrid}>
            <View style={styles.statsCol}>
              <Text style={styles.statsValText}>{expenses.length}</Text>
              <Text style={styles.statsSubText}>Posts</Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.statsValText}>{(totalBudget / 1000000).toFixed(1)}M</Text>
              <Text style={styles.statsSubText}>Budget Limit</Text>
            </View>
            <View style={styles.statsColGreen}>
              <Text style={styles.statsValTextGreen}>{Math.round(ratio)}%</Text>
              <Text style={styles.statsSubTextGreen}>Budget used</Text>
            </View>
          </View>

          {/* Info Help box */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color={THEME.textSecondary} />
            <Text style={styles.infoCardText}>
              Ứng dụng đang hoạt động ở chế độ cá nhân. Các hình ảnh và chi phí được lưu trữ hoàn toàn riêng tư.
            </Text>
          </View>
        </ScrollView>
      )}

      {screen === "settings" && (
        // =============================================
        // SCREEN 2: SETTINGS PANEL
        // =============================================
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBack} onPress={() => setScreen("profile")}>
              <Ionicons name="arrow-back" size={16} color={THEME.textSecondary} />
              <Text style={styles.headerBackText}>Settings</Text>
            </TouchableOpacity>
          </View>

          {/* BUDGET Section */}
          <Text style={styles.settingsSectionHeader}>BUDGET</Text>
          <View style={styles.settingsFormCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="wallet-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Monthly budget</Text>
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
                <Text style={styles.rowLabelText}>Categories</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={THEME.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="cash-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Currency</Text>
              </View>
              <Text style={styles.rowValueText}>VND</Text>
            </View>
          </View>

          {/* NOTIFICATIONS Section */}
          <Text style={styles.settingsSectionHeader}>NOTIFICATIONS</Text>
          <View style={styles.settingsFormCard}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="image-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>New posts</Text>
              </View>
              <Switch
                value={newPostsToggle}
                onValueChange={setNewPostsToggle}
                trackColor={{ false: THEME.borderSecondary, true: "#2C2C2A" }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="card-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Expense logged</Text>
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
                <Text style={styles.rowLabelText}>Budget alerts</Text>
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
          <Text style={styles.settingsSectionHeader}>ACCOUNT</Text>
          <View style={styles.settingsFormCard}>
            <TouchableOpacity style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="shield-checkmark-outline" size={13} color={THEME.textSecondary} />
                <Text style={styles.rowLabelText}>Privacy</Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color={THEME.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleLogout}>
              <View style={styles.rowLeft}>
                <Ionicons name="log-out-outline" size={13} color="#E24B4A" />
                <Text style={[styles.rowLabelText, { color: "#E24B4A" }]}>Sign out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {screen === "categories" && (
        // =============================================
        // SCREEN 3: BUDGET CATEGORY SETTINGS PANEL
        // =============================================
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBack} onPress={() => setScreen("settings")}>
              <Ionicons name="arrow-back" size={16} color={THEME.textSecondary} />
              <Text style={styles.headerBackText}>Categories</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="add" size={18} color={THEME.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesListBlock}>
            {/* Category row: Food */}
            <View style={styles.catBudgetRow}>
              <View style={[styles.catIconCircle, { backgroundColor: "#E1F5EE" }]}>
                <Ionicons name="restaurant" size={12} color="#0F6E56" />
              </View>
              <View style={styles.catBudgetContent}>
                <Text style={styles.catNameText}>Food & Drink</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: "80%", backgroundColor: "#1D9E75" }]} />
                </View>
              </View>
              <View style={styles.catBudgetLimit}>
                <Text style={styles.limitValue}>2,000k</Text>
                <Text style={styles.limitSub}>limit</Text>
              </View>
            </View>

            {/* Transport */}
            <View style={styles.catBudgetRow}>
              <View style={[styles.catIconCircle, { backgroundColor: "#FAEEDA" }]}>
                <Ionicons name="car" size={12} color="#854F0B" />
              </View>
              <View style={styles.catBudgetContent}>
                <Text style={styles.catNameText}>Transport</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: "100%", backgroundColor: "#E24B4A" }]} />
                </View>
              </View>
              <View style={styles.catBudgetLimit}>
                <Text style={[styles.limitValue, { color: "#E24B4A" }]}>800k</Text>
                <Text style={[styles.limitSub, { color: "#E24B4A" }]}>exceeded</Text>
              </View>
            </View>

            {/* Shopping */}
            <View style={styles.catBudgetRow}>
              <View style={[styles.catIconCircle, { backgroundColor: "#EEEDFE" }]}>
                <Ionicons name="bag-handle" size={12} color="#534AB7" />
              </View>
              <View style={styles.catBudgetContent}>
                <Text style={styles.catNameText}>Shopping</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: "30%", backgroundColor: "#7F77DD" }]} />
                </View>
              </View>
              <View style={styles.catBudgetLimit}>
                <Text style={styles.limitValue}>1,000k</Text>
                <Text style={styles.limitSub}>limit</Text>
              </View>
            </View>

            {/* Health */}
            <View style={styles.catBudgetRow}>
              <View style={[styles.catIconCircle, { backgroundColor: "#FCEBEB" }]}>
                <Ionicons name="heart" size={12} color="#A32D2D" />
              </View>
              <View style={styles.catBudgetContent}>
                <Text style={styles.catNameText}>Health</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: "10%", backgroundColor: "#E24B4A" }]} />
                </View>
              </View>
              <View style={styles.catBudgetLimit}>
                <Text style={styles.limitValue}>500k</Text>
                <Text style={styles.limitSub}>limit</Text>
              </View>
            </View>

            {/* Entertainment */}
            <View style={styles.catBudgetRow}>
              <View style={[styles.catIconCircle, { backgroundColor: "#E6F1FB" }]}>
                <Ionicons name="game-controller" size={12} color="#185FA5" />
              </View>
              <View style={styles.catBudgetContent}>
                <Text style={styles.catNameText}>Entertainment</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: "50%", backgroundColor: "#378ADD" }]} />
                </View>
              </View>
              <View style={styles.catBudgetLimit}>
                <Text style={styles.limitValue}>700k</Text>
                <Text style={styles.limitSub}>limit</Text>
              </View>
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerBackText: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  profileBox: {
    alignItems: "center",
    gap: 8,
    marginVertical: 14,
  },
  avatarBig: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E1F5EE",
    borderWidth: 2,
    borderColor: "#9FE1CB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarBigText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#0F6E56",
  },
  nameCenter: {
    alignItems: "center",
  },
  profileName: {
    fontSize: 12,
    fontWeight: "500",
    color: THEME.textPrimary,
  },
  profileSub: {
    fontSize: 9,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  statsCardGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsCol: {
    flex: 1,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
  },
  statsColGreen: {
    flex: 1,
    backgroundColor: "#E1F5EE",
    borderWidth: 0.5,
    borderColor: "#9FE1CB",
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
  },
  statsValText: {
    fontSize: 11,
    fontWeight: "500",
    color: THEME.textPrimary,
  },
  statsSubText: {
    fontSize: 7,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  statsValTextGreen: {
    fontSize: 11,
    fontWeight: "500",
    color: "#085041",
  },
  statsSubTextGreen: {
    fontSize: 7,
    color: "#1D9E75",
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  infoCardText: {
    flex: 1,
    fontSize: 10,
    color: THEME.textSecondary,
    lineHeight: 14,
  },
  settingsSectionHeader: {
    fontSize: 8,
    fontWeight: "600",
    color: THEME.textTertiary,
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  settingsFormCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 10,
    marginHorizontal: 16,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.borderSecondary,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabelText: {
    fontSize: 9,
    color: THEME.textPrimary,
  },
  rowInput: {
    fontSize: 9,
    color: THEME.textSecondary,
    padding: 0,
    textAlign: "right",
    width: 100,
  },
  rowValueText: {
    fontSize: 9,
    color: THEME.textSecondary,
  },
  categoriesListBlock: {
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 6,
  },
  catBudgetRow: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 10,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  catIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  catBudgetContent: {
    flex: 1,
  },
  catNameText: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.textPrimary,
  },
  progressTrack: {
    height: 3,
    backgroundColor: THEME.borderSecondary,
    borderRadius: 1.5,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1.5,
  },
  catBudgetLimit: {
    alignItems: "flex-end",
  },
  limitValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.textPrimary,
  },
  limitSub: {
    fontSize: 7,
    color: THEME.textTertiary,
  },
});
