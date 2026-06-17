import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { useAuthStore, usePostStore, useCircleStore, useExpenseStore, Post } from "../../src/core/store";
import { THEME, mapIconToIonicons } from "../../src/core/theme";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../../src/core/supabaseClient";

export default function Feed() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const { myCircle, fetchMyCircle } = useCircleStore();
  const { posts, fetchPosts, subscribeRealtime, unsubscribeRealtime, isLoading } = usePostStore();
  const { categories, fetchDashboardData } = useExpenseStore();
  const { deletePost, updatePost } = usePostStore();

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [linkedExpense, setLinkedExpense] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      // In personal mode, we don't strictly require circle but we fetch config if needed
      fetchMyCircle(profile.id);
      fetchDashboardData(profile.id);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      // Circle is null in personal mode, so we pass null to only view personal posts
      fetchPosts(null, profile.id);
      subscribeRealtime(null, profile.id);
    }
    return () => {
      unsubscribeRealtime();
    };
  }, [profile]);

  useEffect(() => {
    if (selectedPost) {
      // Fetch associated expense for this post
      supabase
        .from("expenses")
        .select(`
          id,
          amount,
          category_id,
          expense_categories (
            name,
            icon,
            color
          )
        `)
        .eq("post_id", selectedPost.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setLinkedExpense(data);
            setEditAmount(String(data.amount));
            setEditCategoryId(data.category_id);
          } else {
            setLinkedExpense(null);
            setEditAmount("");
            setEditCategoryId(null);
          }
        });
      setEditCaption(selectedPost.caption || "");
      setIsEditing(false);
    } else {
      setLinkedExpense(null);
      setIsEditing(false);
    }
  }, [selectedPost]);

  const handleSaveEdit = async () => {
    if (!selectedPost) return;
    const parsedAmount = editAmount.trim() ? parseFloat(editAmount.replace(/,/g, "")) : null;
    
    const success = await updatePost(
      selectedPost.id,
      editCaption,
      editCategoryId,
      parsedAmount
    );
    
    if (success) {
      setSelectedPost((prev) =>
        prev
          ? {
              ...prev,
              caption: editCaption || null,
              has_expense: parsedAmount !== null && parsedAmount > 0,
            }
          : null
      );
      
      // Reload linked expense
      if (parsedAmount !== null && parsedAmount > 0) {
        supabase
          .from("expenses")
          .select(`
            id,
            amount,
            category_id,
            expense_categories (
              name,
              icon,
              color
            )
          `)
          .eq("post_id", selectedPost.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setLinkedExpense(data);
          });
      } else {
        setLinkedExpense(null);
      }
      
      setIsEditing(false);
      Alert.alert("Thành công", "Đã cập nhật bài viết.");
    } else {
      Alert.alert("Lỗi", "Không thể cập nhật bài viết.");
    }
  };

  const handleDeletePost = () => {
    if (!selectedPost) return;
    Alert.alert(
      "Xóa bài viết",
      "Bạn có chắc chắn muốn xóa bài viết và chi tiêu liên quan không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            const success = await deletePost(selectedPost.id);
            if (success) {
              setSelectedPost(null);
              Alert.alert("Thành công", "Đã xóa bài viết.");
            } else {
              Alert.alert("Lỗi", "Không thể xóa bài viết.");
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    let interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval} ngày trước`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval} giờ trước`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval} phút trước`;
    return "vừa xong";
  };

  const getSenderName = (post: Post) => {
    if (post.author_id === profile?.id) {
      return "Tôi";
    }
    return post.profiles?.display_name || post.profiles?.username || "Thành viên";
  };

  const extractAmountFromCaption = (caption: string | null): string => {
    if (!caption) return "";
    const match = caption.match(/(\d[\d.,]*)\s*(k|K|nghìn|đ|₫|vnd|VND|\$)?/);
    if (match) return match[0];
    return "";
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    const sender = getSenderName(item);
    const amountTag = extractAmountFromCaption(item.caption);

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => setSelectedPost(item)}
        style={styles.postCard}
      >
        <View style={styles.imageContainer}>
          <ExpoImage
            source={{ uri: item.photo_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {/* Top overlay gradient */}
          <View style={[styles.gradient, styles.gradientTop]} />
          {/* Bottom overlay gradient */}
          <View style={[styles.gradient, styles.gradientBottom]} />

          {/* Top overlay credentials */}
          <View style={styles.overlayHeader}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>
                {sender.substring(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.overlayAuthor}>
              {sender} · {formatTimeAgo(item.created_at)}
            </Text>
          </View>

          {/* Bottom overlay caption */}
          {item.caption && (
            <View style={styles.overlayCaptionRow}>
              <Text style={styles.overlayCaption} numberOfLines={1}>
                {item.caption}
              </Text>
            </View>
          )}

          {/* Top right expense pill (if applicable) */}
          {item.has_expense && (
            <View style={styles.expensePill}>
              <Ionicons
                name={
                  item.expense?.expense_categories?.icon
                    ? (mapIconToIonicons(item.expense.expense_categories.icon) as any)
                    : "logo-usd"
                }
                size={8}
                color={item.expense?.expense_categories?.color || THEME.green.text}
                style={{ marginRight: 2 }}
              />
              <Text style={styles.expensePillText}>
                {item.expense?.expense_categories?.name ? `${item.expense.expense_categories.name} · ` : ""}
                {item.expense
                  ? item.expense.amount >= 1000
                    ? `${(item.expense.amount / 1000).toFixed(0)}k`
                    : `${item.expense.amount}đ`
                  : amountTag}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nhật ký của tôi</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push("/(tabs)/camera")}
          >
            <Ionicons name="camera-outline" size={20} color={THEME.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed List */}
      {isLoading && posts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={THEME.textPrimary} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={48} color={THEME.textTertiary} />
          <Text style={styles.emptyText}>Chưa có khoảnh khắc nào được chụp.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPostItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isLoading}
          onRefresh={() => profile && fetchPosts(null, profile.id)}
        />
      )}

      {/* Post Full View Modal */}
      {selectedPost && (
        <Modal
          visible={!!selectedPost}
          animationType="slide"
          onRequestClose={() => setSelectedPost(null)}
        >
          <View style={styles.detailContainer}>
            <View style={styles.statusShim} />
            
            {/* Image frame */}
            <View style={styles.detailFrame}>
              <ExpoImage
                source={{ uri: selectedPost.photo_url }}
                style={styles.detailImage}
                contentFit="cover"
              />
              <View style={[styles.gradient, styles.gradientTop]} />
              <View style={[styles.gradient, styles.gradientBottom]} />

              {/* Close button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedPost(null)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>

              {/* Edit button (Only show for the author) */}
              {selectedPost.author_id === profile?.id && !isEditing && (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setIsEditing(true)}
                >
                  <Ionicons name="pencil" size={16} color="#fff" />
                </TouchableOpacity>
              )}

              {/* Top center Author */}
              <View style={styles.detailAuthorPill}>
                <View style={styles.avatarMini}>
                  <Text style={styles.avatarMiniText}>
                    {getSenderName(selectedPost).substring(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.detailAuthorText}>
                  {getSenderName(selectedPost)}
                </Text>
              </View>

              {/* Caption details at bottom of photo (Only show if not editing) */}
              {!isEditing && (
                <>
                  <View style={styles.detailPhotoFooter}>
                    {selectedPost.caption && (
                      <Text style={styles.detailPhotoCaption}>
                        {selectedPost.caption}
                      </Text>
                    )}
                    {selectedPost.has_expense && (
                      <View style={styles.detailExpenseTag}>
                        <Ionicons
                          name={
                            (linkedExpense?.expense_categories?.icon
                              ? mapIconToIonicons(linkedExpense.expense_categories.icon)
                              : selectedPost.expense?.expense_categories?.icon
                              ? mapIconToIonicons(selectedPost.expense.expense_categories.icon)
                              : "logo-usd") as any
                          }
                          size={12}
                          color={
                            linkedExpense?.expense_categories?.color ||
                            selectedPost.expense?.expense_categories?.color ||
                            THEME.green.text
                          }
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.detailExpenseTagText}>
                          {linkedExpense
                            ? `${linkedExpense.amount.toLocaleString("vi-VN")} ₫ · ${linkedExpense.expense_categories?.name || "Chi tiêu"}`
                            : selectedPost.expense
                            ? `${selectedPost.expense.amount.toLocaleString("vi-VN")} ₫ · ${selectedPost.expense.expense_categories?.name || "Chi tiêu"}`
                            : `${extractAmountFromCaption(selectedPost.caption) || "Chi tiêu"}`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.detailTime}>
                    {formatTimeAgo(selectedPost.created_at)}
                  </Text>
                </>
              )}
            </View>

            {/* Editing form or bottom info section */}
            {isEditing ? (
              <ScrollView style={styles.editFormScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.editFormLabel}>Mô tả bài viết</Text>
                <TextInput
                  style={styles.editFormInput}
                  value={editCaption}
                  onChangeText={setEditCaption}
                  placeholder="Nhập mô tả chi tiêu..."
                  placeholderTextColor={THEME.textTertiary}
                />

                <Text style={styles.editFormLabel}>Số tiền (để trống nếu không có chi tiêu)</Text>
                <TextInput
                  style={styles.editFormInput}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  placeholder="Nhập số tiền (VND)..."
                  placeholderTextColor={THEME.textTertiary}
                  keyboardType="numeric"
                />

                {editAmount.trim() !== "" && parseFloat(editAmount.replace(/,/g, "")) > 0 && (
                  <>
                    <Text style={styles.editFormLabel}>Chọn danh mục</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.catPickerRow}
                      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    >
                      {categories.map((cat) => {
                        const isSelected = editCategoryId === cat.id;
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.catPickerChip,
                              isSelected && styles.catPickerChipActive,
                            ]}
                            onPress={() => setEditCategoryId(cat.id)}
                          >
                            <Ionicons
                              name={mapIconToIonicons(cat.icon) as any}
                              size={14}
                              color={isSelected ? THEME.buttonText : THEME.textPrimary}
                            />
                            <Text style={[
                              styles.catPickerChipText,
                              isSelected && { color: THEME.buttonText },
                            ]}>
                              {cat.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}

                <View style={styles.editActionsBlock}>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                    <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deletePostBtn} onPress={handleDeletePost}>
                    <Text style={styles.deletePostBtnText}>Xóa bài viết</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              /* Bottom info section (Only show if not editing and has expense) */
              !isEditing && selectedPost.has_expense && (
                <View style={styles.detailBottomBlock}>
                  <View style={styles.detailExpenseCard}>
                    <View style={styles.detailExpenseLeft}>
                      <View style={[
                        styles.iconCircle,
                        (linkedExpense?.expense_categories?.color || selectedPost.expense?.expense_categories?.color) && {
                          backgroundColor: (linkedExpense?.expense_categories?.color || selectedPost.expense?.expense_categories?.color) + "20"
                        }
                      ]}>
                        <Ionicons
                          name={
                            linkedExpense?.expense_categories?.icon
                              ? (mapIconToIonicons(linkedExpense.expense_categories.icon) as any)
                              : selectedPost.expense?.expense_categories?.icon
                              ? (mapIconToIonicons(selectedPost.expense.expense_categories.icon) as any)
                              : "restaurant"
                          }
                          size={14}
                          color={
                            linkedExpense?.expense_categories?.color ||
                            selectedPost.expense?.expense_categories?.color ||
                            THEME.green.text
                          }
                        />
                      </View>
                      <View>
                        <Text style={styles.detailCategoryName}>
                          {linkedExpense?.expense_categories?.name ||
                            selectedPost.expense?.expense_categories?.name ||
                            "Chi tiêu"}
                        </Text>
                        <Text style={styles.detailSubText}>Hôm nay · tự động ghi nhận</Text>
                      </View>
                    </View>
                    <Text style={styles.detailAmountText}>
                      {linkedExpense
                        ? `${linkedExpense.amount.toLocaleString("vi-VN")} ₫`
                        : selectedPost.expense
                        ? `${selectedPost.expense.amount.toLocaleString("vi-VN")} ₫`
                        : `${extractAmountFromCaption(selectedPost.caption) || "0"} ₫`}
                    </Text>
                  </View>
                </View>
              )
            )}
          </View>
        </Modal>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  postCard: {
    width: "100%",
    aspectRatio: 1.15,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
  },
  imageContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: THEME.borderPrimary,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 60,
  },
  gradientTop: {
    top: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  gradientBottom: {
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    height: 80,
  },
  overlayHeader: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  avatarMiniText: {
    fontSize: 11,
    fontWeight: "bold",
    color: THEME.green.text,
  },
  overlayAuthor: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  overlayCaptionRow: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 60,
  },
  overlayCaption: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  expensePill: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  expensePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.green.text,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  emptyText: {
    color: THEME.textSecondary,
    fontSize: 15,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: "#111",
    paddingHorizontal: 16,
  },
  statusShim: {
    height: Platform.OS === "ios" ? 44 : 20,
  },
  detailFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 28,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#222",
  },
  detailImage: {
    width: "100%",
    height: "100%",
  },
  closeBtn: {
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
  editBtn: {
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
  detailAuthorPill: {
    position: "absolute",
    top: 14,
    left: "50%",
    transform: [{ translateX: -60 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  detailAuthorText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  detailPhotoFooter: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
  detailPhotoCaption: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  detailExpenseTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  detailExpenseTagText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  detailTime: {
    position: "absolute",
    bottom: 16,
    right: 16,
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  detailBottomBlock: {
    paddingVertical: 18,
    gap: 12,
  },
  detailExpenseCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailExpenseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  detailCategoryName: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  detailSubText: {
    color: THEME.textSecondary,
    fontSize: 11,
  },
  detailAmountText: {
    color: THEME.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  detailActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailActionPill: {
    flex: 1,
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    paddingVertical: 10,
    alignItems: "center",
  },
  detailActionText: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  // Edit form styles
  editFormScroll: {
    paddingVertical: 18,
    paddingHorizontal: 4,
  },
  editFormLabel: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 8,
  },
  editFormInput: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 1,
    borderColor: THEME.borderPrimary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.textPrimary,
  },
  catPickerRow: {
    marginVertical: 4,
  },
  catPickerChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 1,
    borderColor: THEME.borderPrimary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  catPickerChipActive: {
    backgroundColor: THEME.textPrimary,
    borderColor: THEME.textPrimary,
  },
  catPickerChipText: {
    fontSize: 13,
    color: THEME.textPrimary,
  },
  editActionsBlock: {
    marginTop: 24,
    gap: 12,
    paddingBottom: 40,
  },
  saveBtn: {
    backgroundColor: THEME.green.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  deletePostBtn: {
    backgroundColor: "rgba(226, 75, 74, 0.1)",
    borderWidth: 1,
    borderColor: "#E24B4A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deletePostBtnText: {
    color: "#E24B4A",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelBtn: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: THEME.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },
});
