import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from "react-native";
import { useAuthStore, useExpenseStore, Expense, ExpenseCategory } from "../../src/core/store";
import { THEME } from "../../src/core/theme";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { supabase } from "../../src/core/supabaseClient";

export default function ExpenseScreen() {
  const profile = useAuthStore((state) => state.profile);
  const {
    expenses,
    categories,
    totalSpent,
    totalBudget,
    currencyCode,
    fetchDashboardData,
    createExpense,
    deleteExpense,
    isLoading,
  } = useExpenseStore();

  const [activeSegment, setActiveSegment] = useState<"dashboard" | "stats" | "alerts">("dashboard");
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Form states
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);

  useEffect(() => {
    if (profile) {
      fetchDashboardData(profile.id);
    }
  }, [profile]);

  const handleAddExpense = async () => {
    const parsedAmount = parseFloat(amount);
    if (parsedAmount > 0 && selectedCategory && profile) {
      const success = await createExpense(
        profile.id,
        parsedAmount,
        description,
        selectedCategory.id,
        new Date()
      );
      if (success) {
        setIsAddModalVisible(false);
        setAmount("");
        setDescription("");
        setSelectedCategory(categories[0] || null);
      }
    }
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    setSelectedExpense(null);
  };

  const getCategoryDetails = (catId: string | null) => {
    const cat = categories.find((c) => c.id === catId);
    
    // Theme mappings from design mockups
    let color = THEME.gray.solid;
    let bg = THEME.gray.bg;
    let icon = "cart";
    
    if (cat) {
      if (cat.name.includes("Ăn uống") || cat.name.includes("Food")) {
        color = THEME.green.solid;
        bg = THEME.green.bg;
        icon = "restaurant";
      } else if (cat.name.includes("Di chuyển") || cat.name.includes("Transport")) {
        color = THEME.orange.solid;
        bg = THEME.orange.bg;
        icon = "car";
      } else if (cat.name.includes("Mua sắm") || cat.name.includes("Shopping")) {
        color = THEME.purple.solid;
        bg = THEME.purple.bg;
        icon = "bag-handle";
      } else if (cat.name.includes("Sức khỏe") || cat.name.includes("Health")) {
        color = THEME.red.solid;
        bg = THEME.red.bg;
        icon = "heart";
      } else if (cat.name.includes("Giải trí") || cat.name.includes("Entertainment")) {
        color = THEME.blue.solid;
        bg = THEME.blue.bg;
        icon = "game-controller";
      }
    }

    return {
      name: cat?.name || "Khác",
      icon,
      color,
      bg,
    };
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("vi-VN") + " ₫";
  };

  // Ring computations
  const radius = 20;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const ratio = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const strokeDashoffset = circumference - Math.min(ratio, 1.0) * circumference;

  // Chart aggregation per category
  const categoryChartSums = React.useMemo(() => {
    const sums: Record<string, { amount: number; color: string; icon: string }> = {};
    expenses.forEach((e) => {
      const cat = getCategoryDetails(e.category_id);
      sums[cat.name] = {
        amount: (sums[cat.name]?.amount || 0) + e.amount,
        color: cat.color,
        icon: cat.icon,
      };
    });
    return Object.entries(sums)
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, categories]);

  const maxChartVal = categoryChartSums[0]?.amount || 1;

  // Dynamic calculations for stats screen
  const remainingBudget = Math.max(0, totalBudget - totalSpent);
  const topCategorySum = categoryChartSums[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Expense</Text>
          <View style={styles.monthPill}>
            <Text style={styles.monthPillText}>June 2025</Text>
            <Ionicons name="chevron-down" size={10} color={THEME.textTertiary} />
          </View>
        </View>

        {/* Floating trigger add */}
        <TouchableOpacity
          style={styles.addIconCircle}
          onPress={() => {
            setSelectedCategory(categories[0] || null);
            setIsAddModalVisible(true);
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Internal Sub Navigation segments */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "dashboard" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("dashboard")}
        >
          <Text style={[styles.segmentText, activeSegment === "dashboard" && styles.segmentTextActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "stats" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("stats")}
        >
          <Text style={[styles.segmentText, activeSegment === "stats" && styles.segmentTextActive]}>
            Stats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "alerts" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("alerts")}
        >
          <Text style={[styles.segmentText, activeSegment === "alerts" && styles.segmentTextActive]}>
            Alerts
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeSegment === "dashboard" && (
          // =============================================
          // DASHBOARD TAB (Screen 1)
          // =============================================
          <View style={styles.tabContent}>
            {/* Balance ring card */}
            <View style={styles.balanceRingCard}>
              <View style={styles.ringFrame}>
                <Svg width="56" height="56" viewBox="0 0 52 52">
                  <SvgCircle
                    cx="26"
                    cy="26"
                    r={radius}
                    fill="none"
                    stroke={THEME.borderPrimary}
                    strokeWidth={strokeWidth}
                  />
                  <SvgCircle
                    cx="26"
                    cy="26"
                    r={radius}
                    fill="none"
                    stroke={THEME.textPrimary}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 26 26)"
                  />
                </Svg>
                <View style={styles.ringTextContainer}>
                  <Text style={styles.ringPercentageText}>{Math.round(ratio * 100)}%</Text>
                </View>
              </View>

              <View style={styles.balanceInfo}>
                <Text style={styles.balanceSubTitle}>Spent this month</Text>
                <Text style={styles.balanceSpentVal}>{formatCurrency(totalSpent)}</Text>
                <Text style={styles.balanceBudgetVal}>of {formatCurrency(totalBudget)} budget</Text>
              </View>
            </View>

            {/* Category horizontal bar chart breakdown */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>By category</Text>
              {categoryChartSums.length === 0 ? (
                <Text style={styles.emptyCardText}>No spend data this month.</Text>
              ) : (
                <View style={styles.chartBlock}>
                  {categoryChartSums.map((item, index) => (
                    <View key={index} style={styles.chartBarRow}>
                      <Ionicons name={(item.icon + "-outline") as any} size={14} color={item.color} style={styles.chartIcon} />
                      <View style={styles.trackContainer}>
                        <View
                          style={[
                            styles.trackFill,
                            {
                              width: `${(item.amount / maxChartVal) * 100}%`,
                              backgroundColor: item.color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.chartValText}>
                        {(item.amount / 1000).toFixed(0)}k
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Recent list cards */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>Recent</Text>
              {expenses.length === 0 ? (
                <Text style={styles.emptyCardText}>No transactions logged.</Text>
              ) : (
                <View style={styles.recentList}>
                  {expenses.slice(0, 5).map((item) => {
                    const cat = getCategoryDetails(item.category_id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.recentItem}
                        onPress={() => setSelectedExpense(item)}
                      >
                        <View style={styles.recentLeft}>
                          <Ionicons name={(cat.icon + "-outline") as any} size={13} color={cat.color} />
                          <View>
                            <Text style={styles.recentDesc}>{item.description || cat.name}</Text>
                            <Text style={styles.recentDate}>Today</Text>
                          </View>
                        </View>
                        <Text style={styles.recentAmount}>{formatCurrency(item.amount)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {activeSegment === "stats" && (
          // =============================================
          // STATISTICS TAB (Screen 2)
          // =============================================
          <View style={styles.tabContent}>
            {/* Day Bar Chart */}
            <View style={styles.statsChartCard}>
              <View style={styles.statsBarsContainer}>
                {/* Visual daily bars mocks */}
                <View style={[styles.barColumn, { height: "25%" }]} />
                <View style={[styles.barColumn, { height: "45%" }]} />
                <View style={[styles.barColumn, { height: "30%" }]} />
                <View style={[styles.barColumn, { height: "70%" }]} />
                <View style={[styles.barColumn, styles.barColumnActive, { height: "85%" }]} />
                <View style={[styles.barColumn, { height: "20%" }]} />
                <View style={[styles.barColumn, { height: "55%" }]} />
              </View>
              <View style={styles.statsLabelRow}>
                <Text style={styles.statsLabel}>Mon</Text>
                <Text style={styles.statsLabel}>Tue</Text>
                <Text style={styles.statsLabel}>Wed</Text>
                <Text style={styles.statsLabel}>Thu</Text>
                <Text style={[styles.statsLabel, styles.statsLabelActive]}>Fri</Text>
                <Text style={styles.statsLabel}>Sat</Text>
                <Text style={styles.statsLabel}>Sun</Text>
              </View>
            </View>

            {/* Total cards split */}
            <View style={styles.splitGrid}>
              <View style={styles.splitCardCream}>
                <Text style={styles.splitCardLabel}>Total spent</Text>
                <Text style={styles.splitCardVal}>{totalSpent.toLocaleString()}</Text>
                <Text style={styles.splitCardUnit}>₫ this month</Text>
              </View>
              <View style={styles.splitCardGreen}>
                <Text style={styles.splitCardLabelGreen}>Remaining</Text>
                <Text style={styles.splitCardValGreen}>{remainingBudget.toLocaleString()}</Text>
                <Text style={styles.splitCardUnitGreen}>₫ left</Text>
              </View>
            </View>

            {/* Top Category Card */}
            {topCategorySum && (
              <View style={styles.topCategoryCard}>
                <View style={styles.topCategoryLeft}>
                  <View style={[styles.topCategoryIconBox, { backgroundColor: THEME.green.bg }]}>
                    <Ionicons name={(topCategorySum.icon + "-outline") as any} size={12} color={THEME.green.text} />
                  </View>
                  <View>
                    <Text style={styles.topCategoryTitle}>{topCategorySum.name}</Text>
                    <Text style={styles.topCategorySub}>Top category</Text>
                  </View>
                </View>
                <View style={styles.topCategoryRight}>
                  <Text style={styles.topCategoryValue}>{formatCurrency(topCategorySum.amount)}</Text>
                  <Text style={styles.topCategoryRatio}>
                    {Math.round((topCategorySum.amount / (totalSpent || 1)) * 100)}%
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {activeSegment === "alerts" && (
          // =============================================
          // ALERTS/NOTIFICATIONS TAB (Screen 3)
          // =============================================
          <View style={styles.tabContent}>
            {/* Warning Budget alert */}
            <View style={styles.alertCardWarning}>
              <View style={[styles.alertIconBox, { backgroundColor: THEME.orange.solid }]}>
                <Ionicons name="warning" size={13} color="#fff" />
              </View>
              <View style={styles.alertDetails}>
                <Text style={styles.alertTitleWarning}>Budget Alert — Food & Drink</Text>
                <Text style={styles.alertBodyWarning}>
                  You've used 80% of your monthly Food & Drink budget.
                </Text>
                <Text style={styles.alertTimeWarning}>2m ago</Text>
              </View>
            </View>

            {/* Shared post notification info */}
            <View style={styles.alertCardNormal}>
              <View style={styles.alertAvatar}>
                <Text style={styles.alertAvatarText}>A</Text>
              </View>
              <View style={styles.alertDetails}>
                <Text style={styles.alertTitleNormal}>An shared a photo</Text>
                <Text style={styles.alertBodyNormal}>
                  Grab về nhà 35K 🛵 · 35,000 ₫ logged
                </Text>
                <Text style={styles.alertTimeNormal}>1h ago</Text>
              </View>
            </View>

            {/* Auto-logged details notification */}
            <View style={[styles.alertCardNormal, { opacity: 0.6 }]}>
              <View style={styles.alertIconBoxNormal}>
                <Ionicons name="card" size={13} color={THEME.green.text} />
              </View>
              <View style={styles.alertDetails}>
                <Text style={styles.alertTitleNormal}>Expense logged</Text>
                <Text style={styles.alertBodyNormal}>
                  Coffee sáng 45k · 45,000 ₫ · Food & Drink
                </Text>
                <Text style={styles.alertTimeNormal}>Yesterday</Text>
              </View>
            </View>

            {/* Exceeded budget alert */}
            <View style={[styles.alertCardDanger, { opacity: 0.6 }]}>
              <View style={[styles.alertIconBox, { backgroundColor: THEME.red.solid }]}>
                <Ionicons name="ban" size={13} color="#fff" />
              </View>
              <View style={styles.alertDetails}>
                <Text style={styles.alertTitleDanger}>Budget exceeded — Transport</Text>
                <Text style={styles.alertBodyDanger}>
                  You've gone over your Transport budget this month.
                </Text>
                <Text style={styles.alertTimeDanger}>3 days ago</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Manual Input Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Ghi chi tiêu</Text>
            <ColorPlaceholder />
          </View>

          <ScrollView contentContainerStyle={styles.modalForm}>
            <View style={styles.amountInputContainer}>
              <Text style={styles.amountLabel}>Số tiền (VND)</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={THEME.borderPrimary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus={true}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.groupLabel}>Ghi chú chi tiết</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Mô tả món hàng..."
                placeholderTextColor={THEME.textTertiary}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.groupLabel}>Chọn danh mục</Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => {
                  const details = getCategoryDetails(cat.id);
                  const isSelected = selectedCategory?.id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryCell,
                        isSelected && {
                          backgroundColor: details.color,
                        },
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Ionicons
                        name={(details.icon + "-outline") as any}
                        size={20}
                        color={isSelected ? "#fff" : details.color}
                      />
                      <Text
                        style={[
                          styles.categoryCellText,
                          isSelected && { color: "#fff", fontWeight: "bold" },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!amount.trim() || !selectedCategory || isLoading) && styles.saveBtnDisabled,
              ]}
              onPress={handleAddExpense}
              disabled={!amount.trim() || !selectedCategory || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={THEME.buttonText} />
              ) : (
                <Text style={styles.saveBtnText}>Lưu chi tiêu</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Transaction Details Modal */}
      {selectedExpense && (
        <Modal
          visible={!!selectedExpense}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedExpense(null)}
        >
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setSelectedExpense(null)}
          >
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>Chi tiết giao dịch</Text>
                <TouchableOpacity onPress={() => setSelectedExpense(null)}>
                  <Ionicons name="close" size={24} color={THEME.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mô tả</Text>
                  <Text style={styles.detailVal}>
                    {selectedExpense.description ||
                      getCategoryDetails(selectedExpense.category_id).name}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Số tiền</Text>
                  <Text style={[styles.detailLabel, styles.detailAmount]}>
                    {formatCurrency(selectedExpense.amount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ngày</Text>
                  <Text style={styles.detailVal}>{selectedExpense.expense_date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nguồn nhập</Text>
                  <Text
                    style={[
                      styles.detailVal,
                      selectedExpense.source === "auto" ? { color: "#FF9500" } : {},
                    ]}
                  >
                    {selectedExpense.source === "auto" ? "Tự động phân tích ảnh" : "Thủ công"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(selectedExpense.id)}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.deleteBtnText}>Xóa giao dịch này</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const ColorPlaceholder = () => <View style={{ width: 40 }} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
    paddingTop: Platform.OS === "ios" ? 44 : 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  monthPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthPillText: {
    fontSize: 9,
    color: THEME.textSecondary,
    fontWeight: "500",
  },
  addIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 10,
    padding: 2,
    marginVertical: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: THEME.backgroundPrimary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
  },
  segmentText: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  segmentTextActive: {
    color: THEME.textPrimary,
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  tabContent: {
    paddingHorizontal: 16,
  },
  balanceRingCard: {
    backgroundColor: "#F1EFE8", // Hardcoded background from mockup
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "#D3D1C7", // Sandbox mockup border
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  ringFrame: {
    width: 52,
    height: 52,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  ringTextContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  ringPercentageText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#2C2C2A",
  },
  balanceInfo: {
    flex: 1,
  },
  balanceSubTitle: {
    fontSize: 8,
    color: "#5F5E5A",
    marginBottom: 2,
  },
  balanceSpentVal: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2C2C2A",
  },
  balanceBudgetVal: {
    fontSize: 8,
    color: "#888780",
    marginTop: 2,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: THEME.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  chartBlock: {
    gap: 8,
  },
  chartBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartIcon: {
    width: 14,
  },
  trackContainer: {
    flex: 1,
    height: 5,
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 3,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: 3,
  },
  chartValText: {
    fontSize: 8,
    color: THEME.textSecondary,
    minWidth: 34,
    textAlign: "right",
  },
  recentList: {
    gap: 6,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  recentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recentDesc: {
    fontSize: 9,
    color: THEME.textPrimary,
  },
  recentDate: {
    fontSize: 7,
    color: THEME.textTertiary,
  },
  recentAmount: {
    fontSize: 9,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  emptyCardText: {
    fontSize: 11,
    color: THEME.textTertiary,
    textAlign: "center",
    paddingVertical: 14,
  },
  statsChartCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  statsBarsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 52,
    gap: 2,
    marginBottom: 6,
  },
  barColumn: {
    flex: 1,
    backgroundColor: "#B4B2A9", // Gray/Sand bar
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barColumnActive: {
    backgroundColor: "#2C2C2A", // Current active highlighted bar
  },
  statsLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statsLabel: {
    fontSize: 7,
    color: THEME.textTertiary,
    textAlign: "center",
    flex: 1,
  },
  statsLabelActive: {
    color: "#2C2C2A",
    fontWeight: "bold",
  },
  splitGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  splitCardCream: {
    flex: 1,
    backgroundColor: "#F1EFE8",
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    borderRadius: 10,
    padding: 8,
  },
  splitCardLabel: {
    fontSize: 7,
    color: "#5F5E5A",
    marginBottom: 2,
  },
  splitCardVal: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#2C2C2A",
  },
  splitCardUnit: {
    fontSize: 7,
    color: "#888780",
    marginTop: 1,
  },
  splitCardGreen: {
    flex: 1,
    backgroundColor: THEME.green.bg,
    borderWidth: 0.5,
    borderColor: "#9FE1CB",
    borderRadius: 10,
    padding: 8,
  },
  splitCardLabelGreen: {
    fontSize: 7,
    color: THEME.green.text,
    marginBottom: 2,
  },
  splitCardValGreen: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#085041",
  },
  splitCardUnitGreen: {
    fontSize: 7,
    color: THEME.green.solid,
    marginTop: 1,
  },
  topCategoryCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topCategoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topCategoryIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  topCategoryTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.textPrimary,
  },
  topCategorySub: {
    fontSize: 7,
    color: THEME.textTertiary,
  },
  topCategoryRight: {
    alignItems: "flex-end",
  },
  topCategoryValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.textPrimary,
  },
  topCategoryRatio: {
    fontSize: 7,
    color: THEME.textTertiary,
  },
  alertCardWarning: {
    backgroundColor: "#FAEEDA",
    borderWidth: 0.5,
    borderColor: "#FAC775",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  alertIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  alertDetails: {
    flex: 1,
  },
  alertTitleWarning: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#633806",
    marginBottom: 2,
  },
  alertBodyWarning: {
    fontSize: 8,
    color: "#854F0B",
    lineHeight: 11,
  },
  alertTimeWarning: {
    fontSize: 7,
    color: "#BA7517",
    marginTop: 4,
  },
  alertCardNormal: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  alertAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.green.bg,
    borderWidth: 1.5,
    borderColor: "#9FE1CB",
    justifyContent: "center",
    alignItems: "center",
  },
  alertAvatarText: {
    fontSize: 9,
    color: THEME.green.text,
    fontWeight: "bold",
  },
  alertTitleNormal: {
    fontSize: 9,
    fontWeight: "bold",
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  alertBodyNormal: {
    fontSize: 8,
    color: THEME.textSecondary,
    lineHeight: 11,
  },
  alertTimeNormal: {
    fontSize: 7,
    color: THEME.textTertiary,
    marginTop: 4,
  },
  alertIconBoxNormal: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  alertCardDanger: {
    backgroundColor: "#FCEBEB",
    borderWidth: 0.5,
    borderColor: "#F7C1C1",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  alertTitleDanger: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#501313",
    marginBottom: 2,
  },
  alertBodyDanger: {
    fontSize: 8,
    color: "#791F1F",
    lineHeight: 11,
  },
  alertTimeDanger: {
    fontSize: 7,
    color: "#A32D2D",
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
    paddingTop: Platform.OS === "ios" ? 40 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelText: {
    color: THEME.textSecondary,
    fontSize: 15,
  },
  modalHeaderTitle: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
  modalForm: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  amountInputContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: THEME.textSecondary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  amountInput: {
    color: THEME.textPrimary,
    fontSize: 44,
    fontWeight: "bold",
    textAlign: "center",
    width: "100%",
  },
  inputGroup: {
    marginBottom: 20,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: THEME.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  modalTextInput: {
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    color: THEME.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryCell: {
    width: "31%",
    aspectRatio: 1.3,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  categoryCellText: {
    color: THEME.textSecondary,
    fontSize: 11,
  },
  saveBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: THEME.buttonText,
    fontSize: 16,
    fontWeight: "bold",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  detailCard: {
    backgroundColor: THEME.backgroundPrimary,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    padding: 24,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  detailTitle: {
    color: THEME.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
  },
  detailContent: {
    gap: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    color: THEME.textSecondary,
    fontSize: 14,
  },
  detailVal: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  detailAmount: {
    color: THEME.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: THEME.red.solid,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
  },
  deleteBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
