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
} from "react-native";
import { useAuthStore, usePostStore, Post } from "../../src/core/store";
import { THEME } from "../../src/core/theme";
import { ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function Feed() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const { posts, fetchPosts, subscribeRealtime, unsubscribeRealtime, isLoading } = usePostStore();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    if (profile) {
      fetchPosts(profile.id);
      subscribeRealtime(profile.id);
    }
    return () => {
      unsubscribeRealtime();
    };
  }, [profile]);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    let interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m`;
    return "now";
  };

  const getSenderName = () => {
    return profile ? profile.display_name || profile.username : "Me";
  };

  const extractAmountFromCaption = (caption: string | null): string => {
    if (!caption) return "";
    const match = caption.match(/(\d[\d.,]*)\s*(k|K|nghìn|đ|₫|vnd|VND|\$)?/);
    if (match) return match[0];
    return "";
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    const sender = getSenderName();
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
          {item.has_expense && amountTag && (
            <View style={styles.expensePill}>
              <Ionicons name="logo-usd" size={8} color={THEME.green.text} style={{ marginRight: 2 }} />
              <Text style={styles.expensePillText}>{amountTag}</Text>
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
        <Text style={styles.headerTitle}>Khoảnh khắc của tôi</Text>
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
          onRefresh={() => profile && fetchPosts(profile.id)}
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

              {/* Top center Author */}
              <View style={styles.detailAuthorPill}>
                <View style={styles.avatarMini}>
                  <Text style={styles.avatarMiniText}>
                    {getSenderName().substring(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.detailAuthorText}>
                  {getSenderName()}
                </Text>
              </View>

              {/* Caption details at bottom of photo */}
              <View style={styles.detailPhotoFooter}>
                {selectedPost.caption && (
                  <Text style={styles.detailPhotoCaption}>
                    {selectedPost.caption}
                  </Text>
                )}
                {selectedPost.has_expense && (
                  <View style={styles.detailExpenseTag}>
                    <Ionicons name="logo-usd" size={10} color={THEME.green.text} style={{ marginRight: 3 }} />
                    <Text style={styles.detailExpenseTagText}>
                      {extractAmountFromCaption(selectedPost.caption) || "Chi tiêu"} · Food & Drink
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.detailTime}>
                {formatTimeAgo(selectedPost.created_at)} ago
              </Text>
            </View>

            {/* Bottom info section */}
            {selectedPost.has_expense && (
              <View style={styles.detailBottomBlock}>
                <View style={styles.detailExpenseCard}>
                  <View style={styles.detailExpenseLeft}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="restaurant" size={14} color={THEME.green.text} />
                    </View>
                    <View>
                      <Text style={styles.detailCategoryName}>Food & Drink</Text>
                      <Text style={styles.detailSubText}>Today · auto-logged</Text>
                    </View>
                  </View>
                  <Text style={styles.detailAmountText}>
                    {extractAmountFromCaption(selectedPost.caption) || "10,000"} ₫
                  </Text>
                </View>

                <View style={styles.detailActionsRow}>
                  <TouchableOpacity style={styles.detailActionPill}>
                    <Text style={styles.detailActionText}>Edit expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailActionPill}>
                    <Text style={styles.detailActionText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    padding: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 40,
  },
  postCard: {
    width: "100%",
    aspectRatio: 1.15,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 12,
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
    height: 48,
  },
  gradientTop: {
    top: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  gradientBottom: {
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    height: 60,
  },
  overlayHeader: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatarMini: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  avatarMiniText: {
    fontSize: 8,
    fontWeight: "bold",
    color: THEME.green.text,
  },
  overlayAuthor: {
    fontSize: 9,
    fontWeight: "500",
    color: "#fff",
  },
  overlayCaptionRow: {
    position: "absolute",
    bottom: 10,
    left: 12,
    right: 50,
  },
  overlayCaption: {
    fontSize: 10,
    color: "#fff",
  },
  expensePill: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  expensePillText: {
    fontSize: 9,
    fontWeight: "600",
    color: THEME.green.text,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    color: THEME.textTertiary,
    fontSize: 12,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: "#111",
    paddingHorizontal: 12,
  },
  statusShim: {
    height: Platform.OS === "ios" ? 44 : 20,
  },
  detailFrame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
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
    top: 10,
    left: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  detailAuthorPill: {
    position: "absolute",
    top: 10,
    left: "50%",
    transform: [{ translateX: -40 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
  },
  detailAuthorText: {
    color: "#fff",
    fontSize: 10,
  },
  detailPhotoFooter: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
  detailPhotoCaption: {
    color: "#fff",
    fontSize: 12,
    marginBottom: 6,
  },
  detailExpenseTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  detailExpenseTagText: {
    color: "#fff",
    fontSize: 10,
  },
  detailTime: {
    position: "absolute",
    bottom: 12,
    right: 12,
    fontSize: 9,
    color: "rgba(255,255,255,0.5)",
  },
  detailBottomBlock: {
    paddingVertical: 14,
    gap: 10,
  },
  detailExpenseCard: {
    backgroundColor: THEME.backgroundSecondary,
    borderWidth: 0.5,
    borderColor: THEME.borderPrimary,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailExpenseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.green.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  detailCategoryName: {
    color: THEME.textPrimary,
    fontSize: 10,
    fontWeight: "bold",
  },
  detailSubText: {
    color: THEME.textSecondary,
    fontSize: 8,
  },
  detailAmountText: {
    color: THEME.textPrimary,
    fontSize: 13,
    fontWeight: "bold",
  },
  detailActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  detailActionPill: {
    flex: 1,
    backgroundColor: THEME.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: THEME.borderSecondary,
    paddingVertical: 8,
    alignItems: "center",
  },
  detailActionText: {
    fontSize: 10,
    color: THEME.textSecondary,
  },
});
