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
import { THEME, mapIconToIonicons } from "../../src/core/theme";
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
  const [monthDate, setMonthDate] = useState(new Date());
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  // Form states
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);

  useEffect(() => {
    if (profile) {
      fetchDashboardData(profile.id, monthDate);
    }
  }, [profile, monthDate]);

  const selectMonth = (year: number, month: number) => {
    const newDate = new Date(year, month, 1);
    setMonthDate(newDate);
    setIsMonthPickerVisible(false);
  };

  const MONTHS_VI = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
    "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
    "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ];

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
      if (cat.icon) {
        icon = mapIconToIonicons(cat.icon);
      }
      if (cat.color) {
        color = cat.color;
        bg = cat.color + "22"; // 13% opacity hex
      }
      
      // Override or fallback logic based on names
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
          <Text style={styles.headerTitle}>Chi tiêu</Text>
          {/* Tappable month pill — opens picker modal */}
          <TouchableOpacity
            style={styles.monthPill}
            onPress={() => {
              setPickerYear(monthDate.getFullYear());
              setIsMonthPickerVisible(true);
            }}
          >
            <Ionicons name="calendar-outline" size={13} color={THEME.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.monthPillText}>
              {monthDate.toLocaleString("vi-VN", { month: "long", year: "numeric" })}
            </Text>
            <Ionicons name="chevron-down" size={12} color={THEME.textTertiary} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
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

      {/* Month Picker Modal */}
      <Modal
        visible={isMonthPickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMonthPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setIsMonthPickerVisible(false)}
        >
          <View style={styles.pickerCard}>
            {/* Year row */}
            <View style={styles.pickerYearRow}>
              <TouchableOpacity
                style={styles.pickerYearBtn}
                onPress={() => setPickerYear(y => y - 1)}
              >
                <Ionicons name="chevron-back" size={18} color={THEME.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.pickerYearText}>{pickerYear}</Text>
              <TouchableOpacity
                style={styles.pickerYearBtn}
                onPress={() => setPickerYear(y => y + 1)}
                disabled={pickerYear >= new Date().getFullYear()}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={pickerYear >= new Date().getFullYear() ? THEME.textTertiary : THEME.textPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* 3×4 month grid */}
            <View style={styles.pickerMonthGrid}>
              {MONTHS_VI.map((label, idx) => {
                const isSelected =
                  monthDate.getFullYear() === pickerYear &&
                  monthDate.getMonth() === idx;
                const isFuture =
                  pickerYear > new Date().getFullYear() ||
                  (pickerYear === new Date().getFullYear() && idx > new Date().getMonth());
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.pickerMonthCell,
                      isSelected && styles.pickerMonthCellActive,
                      isFuture && styles.pickerMonthCellDisabled,
                    ]}
                    onPress={() => !isFuture && selectMonth(pickerYear, idx)}
                    disabled={isFuture}
                  >
                    <Text
                      style={[
                        styles.pickerMonthText,
                        isSelected && styles.pickerMonthTextActive,
                        isFuture && styles.pickerMonthTextDisabled,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Internal Sub Navigation segments */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "dashboard" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("dashboard")}
        >
          <Text style={[styles.segmentText, activeSegment === "dashboard" && styles.segmentTextActive]}>
            Tổng quan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "stats" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("stats")}
        >
          <Text style={[styles.segmentText, activeSegment === "stats" && styles.segmentTextActive]}>
            Thống kê
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "alerts" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("alerts")}
        >
          <Text style={[styles.segmentText, activeSegment === "alerts" && styles.segmentTextActive]}>
            Cảnh báo
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
                <Text style={styles.balanceSubTitle}>Đã chi tháng này</Text>
                <Text style={styles.balanceSpentVal}>{formatCurrency(totalSpent)}</Text>
                <Text style={styles.balanceBudgetVal}>trên hạn mức {formatCurrency(totalBudget)}</Text>
              </View>
            </View>

            {/* Category horizontal bar chart breakdown */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>Theo danh mục</Text>
              {categoryChartSums.length === 0 ? (
                <Text style={styles.emptyCardText}>Chưa có dữ liệu chi tiêu tháng này.</Text>
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
              <Text style={styles.sectionHeader}>Chi tiêu gần đây</Text>
              {expenses.length === 0 ? (
                <Text style={styles.emptyCardText}>Chưa ghi nhận giao dịch nào.</Text>
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
                            <Text style={styles.recentDate}>Hôm nay</Text>
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
                <Text style={styles.statsLabel}>T2</Text>
                <Text style={styles.statsLabel}>T3</Text>
                <Text style={styles.statsLabel}>T4</Text>
                <Text style={styles.statsLabel}>T5</Text>
                <Text style={[styles.statsLabel, styles.statsLabelActive]}>T6</Text>
                <Text style={styles.statsLabel}>T7</Text>
                <Text style={styles.statsLabel}>CN</Text>
              </View>
            </View>

            {/* Total cards split */}
            <View style={styles.splitGrid}>
              <View style={styles.splitCardCream}>
                <Text style={styles.splitCardLabel}>Tổng chi tiêu</Text>
                <Text style={styles.splitCardVal}>{totalSpent.toLocaleString()}</Text>
                <Text style={styles.splitCardUnit}>₫ tháng này</Text>
              </View>
              <View style={styles.splitCardGreen}>
                <Text style={styles.splitCardLabelGreen}>Còn lại</Text>
                <Text style={styles.splitCardValGreen}>{remainingBudget.toLocaleString()}</Text>
                <Text style={styles.splitCardUnitGreen}>₫ ngân sách</Text>
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
                    <Text style={styles.topCategorySub}>Danh mục chi nhiều nhất</Text>
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
                <Text style={styles.alertTitleWarning}>Cảnh báo hạn mức — Ăn uống</Text>
                <Text style={styles.alertBodyWarning}>
                  Bạn đã dùng hết 80% hạn mức Ăn uống của tháng này.
                </Text>
                <Text style={styles.alertTimeWarning}>2 phút trước</Text>
              </View>
            </View>

            {/* Shared post notification info */}
            <View style={styles.alertCardNormal}>
              <View style={styles.alertAvatar}>
                <Text style={styles.alertAvatarText}>A</Text>
              </View>
              <View style={styles.alertDetails}>
                <Text style={styles.alertTitleNormal}>An đã chia sẻ ảnh</Text>
                <Text style={styles.alertBodyNormal}>
                  Grab về nhà 35K 🛵 · Đã lưu 35,000 ₫
                </Text>
                <Text style={styles.alertTimeNormal}>1 giờ trước</Text>
              </View>
            </View>

            {/* Auto-logged details notification */}
            <View style={[styles.alertCardNormal, { opacity: 0.6 }]}>
              <View style={styles.alertIconBoxNormal}>
                <Ionicons name="card" size={13} color={THEME.green.text} />
              </View>
              <View style={styles.alertDetails}>
                <Text style={styles.alertTitleNormal}>Chi tiêu đã tự động lưu</Text>
                <Text style={styles.alertBodyNormal}>
                  Coffee sáng 45k · 45,000 ₫ · Ăn uống
                </Text>
                <Text style={styles.alertTimeNormal}>Hôm qua</Text>
              </View>
            </View>

            {/* Exceeded budget alert */}
            <View style={[styles.alertCardDanger, { opacity: 0.6 }]}>
              <View style={[styles.alertIconBox, { backgroundColor: THEME.red.solid }]}>
                <Ionicons name="ban" size={13} color="#fff" />
              </View>
              <View style={styles.alertDetails}>
                <Text style={styles.alertTitleDanger}>Chi tiêu vượt hạn mức — Di chuyển</Text>
                <Text style={styles.alertBodyDanger}>
                  Bạn đã vượt hạn mức Di chuyển của tháng này.
                </Text>
                <Text style={styles.alertTimeDanger}>3 ngày trước</Text>
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
              <Text style={styles.cancelText}>Hủy</Text>
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
                <TouchableOpacity
                  key="add-new-chip"
                  style={[styles.categoryCell, { backgroundColor: THEME.backgroundSecondary, borderWidth: 1, borderColor: THEME.borderSecondary, borderStyle: 'dashed' }]}
                  onPress={() => { /* Handle add new category logic */ }}
                >
                  <Ionicons name="add" size={20} color={THEME.textTertiary} />
                  <Text style={styles.categoryCellText}>Mới</Text>
                </TouchableOpacity>
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
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  monthPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  monthPillText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: "500",
  },
  // Month picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pickerCard: {
    backgroundColor: THEME.backgroundPrimary,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: "100%",
  },
  pickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  pickerYearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerYearText: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  pickerMonthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerMonthCell: {
    width: "22%",
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerMonthCellActive: {
    backgroundColor: THEME.buttonPrimary,
    borderColor: THEME.buttonPrimary,
  },
  pickerMonthCellDisabled: {
    opacity: 0.3,
  },
  pickerMonthText: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: "500",
  },
  pickerMonthTextActive: {
    color: THEME.buttonText,
    fontWeight: "700",
  },
  pickerMonthTextDisabled: {
    color: THEME.textTertiary,
  },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.buttonPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 12,
    padding: 2,
    marginVertical: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: THEME.backgroundPrimary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
  },
  segmentText: {
    fontSize: 14,
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
    backgroundColor: "#F1EFE8",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
  },
  ringFrame: {
    width: 56,
    height: 56,
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
    fontSize: 13,
    fontWeight: "700",
    color: "#2C2C2A",
  },
  balanceInfo: {
    flex: 1,
  },
  balanceSubTitle: {
    fontSize: 12,
    color: "#5F5E5A",
    marginBottom: 4,
  },
  balanceSpentVal: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C2C2A",
  },
  balanceBudgetVal: {
    fontSize: 12,
    color: "#888780",
    marginTop: 4,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  chartBlock: {
    gap: 10,
  },
  chartBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chartIcon: {
    width: 16,
  },
  trackContainer: {
    flex: 1,
    height: 6,
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 3,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: 3,
  },
  chartValText: {
    fontSize: 12,
    color: THEME.textSecondary,
    minWidth: 40,
    textAlign: "right",
  },
  recentList: {
    gap: 8,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recentDesc: {
    fontSize: 14,
    color: THEME.textPrimary,
  },
  recentDate: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  recentAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  emptyCardText: {
    fontSize: 15,
    color: THEME.textTertiary,
    textAlign: "center",
    paddingVertical: 20,
  },
  statsChartCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  statsBarsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 60,
    gap: 4,
    marginBottom: 8,
  },
  barColumn: {
    flex: 1,
    backgroundColor: "#B4B2A9",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barColumnActive: {
    backgroundColor: "#2C2C2A",
  },
  statsLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statsLabel: {
    fontSize: 11,
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
    gap: 8,
    marginBottom: 16,
  },
  splitCardCream: {
    flex: 1,
    backgroundColor: "#F1EFE8",
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    borderRadius: 12,
    padding: 12,
  },
  splitCardLabel: {
    fontSize: 11,
    color: "#5F5E5A",
    marginBottom: 4,
  },
  splitCardVal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C2C2A",
  },
  splitCardUnit: {
    fontSize: 11,
    color: "#888780",
    marginTop: 2,
  },
  splitCardGreen: {
    flex: 1,
    backgroundColor: THEME.green.bg,
    borderWidth: 0.5,
    borderColor: "#9FE1CB",
    borderRadius: 12,
    padding: 12,
  },
  splitCardLabelGreen: {
    fontSize: 11,
    color: THEME.green.text,
    marginBottom: 4,
  },
  splitCardValGreen: {
    fontSize: 16,
    fontWeight: "700",
    color: "#085041",
  },
  splitCardUnitGreen: {
    fontSize: 11,
    color: THEME.green.solid,
    marginTop: 2,
  },
  topCategoryCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topCategoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topCategoryIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  topCategoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  topCategorySub: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  topCategoryRight: {
    alignItems: "flex-end",
  },
  topCategoryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  topCategoryRatio: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  alertCardWarning: {
    backgroundColor: "#FAEEDA",
    borderWidth: 0.5,
    borderColor: "#FAC775",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  alertIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  alertDetails: {
    flex: 1,
  },
  alertTitleWarning: {
    fontSize: 13,
    fontWeight: "700",
    color: "#633806",
    marginBottom: 4,
  },
  alertBodyWarning: {
    fontSize: 12,
    color: "#854F0B",
    lineHeight: 16,
  },
  alertTimeWarning: {
    fontSize: 11,
    color: "#BA7517",
    marginTop: 6,
  },
  alertCardNormal: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  alertAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.green.bg,
    borderWidth: 1.5,
    borderColor: "#9FE1CB",
    justifyContent: "center",
    alignItems: "center",
  },
  alertAvatarText: {
    fontSize: 13,
    color: THEME.green.text,
    fontWeight: "bold",
  },
  alertTitleNormal: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  alertBodyNormal: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  alertTimeNormal: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 6,
  },
  alertIconBoxNormal: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  alertCardDanger: {
    backgroundColor: "#FCEBEB",
    borderWidth: 0.5,
    borderColor: "#F7C1C1",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  alertTitleDanger: {
    fontSize: 13,
    fontWeight: "700",
    color: "#501313",
    marginBottom: 4,
  },
  alertBodyDanger: {
    fontSize: 12,
    color: "#791F1F",
    lineHeight: 16,
  },
  alertTimeDanger: {
    fontSize: 11,
    color: "#A32D2D",
    marginTop: 6,
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
    paddingVertical: 14,
  },
  cancelText: {
    color: THEME.textSecondary,
    fontSize: 16,
  },
  modalHeaderTitle: {
    color: THEME.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  modalForm: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  amountInputContainer: {
    alignItems: "center",
    marginVertical: 24,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textSecondary,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  amountInput: {
    color: THEME.textPrimary,
    fontSize: 48,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  inputGroup: {
    marginBottom: 24,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  modalTextInput: {
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    color: THEME.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryCell: {
    width: "31%",
    aspectRatio: 1.3,
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  categoryCellText: {
    color: THEME.textSecondary,
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: THEME.buttonPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: THEME.buttonText,
    fontSize: 16,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  detailCard: {
    backgroundColor: THEME.backgroundPrimary,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    padding: 24,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  detailTitle: {
    color: THEME.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  detailContent: {
    gap: 18,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    color: THEME.textSecondary,
    fontSize: 15,
  },
  detailVal: {
    color: THEME.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  detailAmount: {
    color: THEME.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: THEME.red.solid,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  deleteBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
