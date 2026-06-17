import { create } from "zustand";
import { supabase } from "./supabaseClient";
import * as Linking from "expo-linking";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

// =============================================
// TYPES DEFINITIONS
// =============================================

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  fcm_token: string | null;
  currency: string;
  created_at?: string;
  updated_at?: string;
}

export interface Post {
  id: string;
  author_id: string;
  circle_id: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  has_expense: boolean;
  created_at: string;
  profiles?: {
    display_name: string | null;
    username: string;
  } | null;
  expense?: {
    id: string;
    amount: number;
    category_id: string | null;
    expense_categories?: {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
    } | null;
  } | null;
}

export interface ExpenseCategory {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  budget_limit: number | null;
  is_default: boolean;
}

export interface Expense {
  id: string;
  user_id: string;
  post_id: string | null;
  circle_id: string | null;
  category_id: string | null;
  amount: number;
  currency: string;
  description: string | null;
  source: string;
  expense_date: string;
  created_at?: string;
}

export interface BudgetPeriod {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_budget: number | null;
  total_spent: number;
  currency: string;
}

export interface Circle {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
}

export interface CircleMember {
  circle_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles?: Profile;
}

// =============================================
// AUTH STORE
// =============================================
interface AuthState {
  user: any | null;
  profile: Profile | null;
  isLoading: boolean;
  errorMessage: string | null;
  isOnboarding: boolean;
  
  checkSession: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  setIsOnboarding: (val: boolean) => void;
  saveProfile: (
    username: string,
    displayName: string,
    selectedCategories: { name: string; icon: string; color: string }[]
  ) => Promise<boolean>;
  updateProfile: (displayName: string, avatarLocalUri: string | null) => Promise<boolean>;
  updateFCMToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,
  errorMessage: null,
  isOnboarding: false,

  checkSession: async () => {
    set({ isLoading: true });
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const user = session.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select()
        .eq("id", user.id)
        .maybeSingle();

      const isNewUser = !profile || (profile.username && profile.username.startsWith("user_"));

      set({ user, profile, isLoading: false, isOnboarding: isNewUser });
    } else {
      set({ user: null, profile: null, isLoading: false });
    }
  },

  signUpWithEmail: async (email, password) => {
    set({ isLoading: true, errorMessage: null });

    const translateError = (msg: string): string => {
      if (msg.includes('rate limit') || msg.includes('email rate limit')) return 'Vui lòng chờ vài phút rồi thử lại.';
      if (msg.includes('already registered') || msg.includes('already been registered')) return 'Email này đã tồn tại. Vui lòng đăng nhập.';
      if (msg.includes('Password should be')) return 'Mật khẩu phải có ít nhất 6 ký tự.';
      if (msg.includes('Invalid email')) return 'Email không hợp lệ.';
      return msg;
    };

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        set({ errorMessage: translateError(error.message), isLoading: false });
        return false;
      }

      const user = data?.user;

      // Email already registered — identities will be empty
      if (user && Array.isArray(user.identities) && user.identities.length === 0) {
        set({ errorMessage: 'Email này đã tồn tại. Vui lòng đăng nhập.', isLoading: false });
        return false;
      }

      if (user) {
        // No email confirmation — go straight to profile setup
        set({ user, profile: null, isLoading: false, isOnboarding: true });
        return true;
      }

      set({ errorMessage: 'Đăng ký thất bại, vui lòng thử lại.', isLoading: false });
      return false;
    } catch (err: any) {
      set({ errorMessage: translateError(err.message || 'Đã xảy ra lỗi.'), isLoading: false });
      return false;
    }
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true, errorMessage: null });
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ errorMessage: error.message, isLoading: false });
        return false;
      }

      if (user) {
        let profile = null;
        try {
          const { data } = await supabase
            .from("profiles")
            .select()
            .eq("id", user.id)
            .maybeSingle();
          profile = data;
        } catch (dbErr) {
          console.warn("Failed to fetch profile during signin", dbErr);
        }

        const isNewUser = !profile || (profile.username && profile.username.startsWith("user_"));

        set({
          user,
          profile,
          isLoading: false,
          isOnboarding: isNewUser,
        });
        return true;
      }
    } catch (err: any) {
      set({ errorMessage: err.message || "Đã xảy ra lỗi đăng nhập." });
    } finally {
      set({ isLoading: false });
    }
    return false;
  },

  signInWithGoogle: async () => {
    set({ isLoading: true, errorMessage: null });
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "snapledger://google-auth",
        },
      });

      if (error) {
        set({ errorMessage: error.message, isLoading: false });
        return;
      }

      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (err: any) {
      set({ errorMessage: err.message || "Không thể khởi chạy đăng nhập Google." });
    } finally {
      set({ isLoading: false });
    }
  },

  setIsOnboarding: (val) => {
    set({ isOnboarding: val });
  },

  saveProfile: async (username, displayName, selectedCategories) => {
    const user = get().user;
    if (!user) return false;
    set({ isLoading: true, errorMessage: null });
    try {
      const newProfile: Omit<Profile, "created_at" | "updated_at"> = {
        id: user.id,
        username: username.toLowerCase().trim(),
        display_name: displayName.trim() || null,
        avatar_url: null,
        phone: user.phone || null,
        fcm_token: null,
        currency: "VND",
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(newProfile)
        .select()
        .single();

      if (error) throw error;

      // 1. Delete any auto-seeded categories for this user
      const { error: deleteError } = await supabase
        .from("expense_categories")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        console.warn("Could not delete default seeded categories:", deleteError.message);
      }

      // 2. Bulk insert the chosen categories
      if (selectedCategories.length > 0) {
        const rows = selectedCategories.map((c) => ({
          user_id: user.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          is_default: false,
        }));
        const { error: insertError } = await supabase
          .from("expense_categories")
          .insert(rows);

        if (insertError) throw insertError;
      }

      set({ profile: data, isOnboarding: false, isLoading: false });
      return true;
    } catch (err: any) {
      set({ errorMessage: err.message || "Không thể thiết lập hồ sơ.", isLoading: false });
      return false;
    }
  },

  updateProfile: async (displayName, avatarLocalUri) => {
    const profile = get().profile;
    if (!profile) return false;
    set({ isLoading: true, errorMessage: null });
    try {
      let avatarUrl = profile.avatar_url;

      if (avatarLocalUri) {
        try {
          // Upload avatar to Supabase Storage bucket 'avatars'
          const base64 = await FileSystem.readAsStringAsync(avatarLocalUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const arrayBuffer = decode(base64);
          // Normalize extension (expo-image-picker may return .jpg or .jpeg)
          const rawExt = avatarLocalUri.split('.').pop()?.toLowerCase() || 'jpg';
          const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
          const path = `${profile.id}/avatar.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, arrayBuffer, {
              contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) {
            // Log but don't fail the whole update — just skip avatar
            console.warn('Avatar upload failed:', uploadError.message);
          } else {
            const { data: publicData } = supabase.storage
              .from('avatars')
              .getPublicUrl(path);
            // Append timestamp to bust CDN cache
            avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;
          }
        } catch (avatarErr: any) {
          console.warn('Avatar upload exception:', avatarErr.message);
          // Continue without avatar update
        }
      }

      // Always update display_name (and avatar_url if upload succeeded)
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      set({ profile: updated, isLoading: false });
      return true;
    } catch (err: any) {
      set({ errorMessage: err.message, isLoading: false });
      return false;
    }
  },

  updateFCMToken: async (token) => {
    const profile = get().profile;
    if (!profile) return;
    await supabase
      .from("profiles")
      .update({ fcm_token: token, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isOnboarding: false, errorMessage: null });

    // Wipe cached data from other stores upon logout to prevent data leakage
    try {
      useExpenseStore.setState({
        expenses: [],
        categories: [],
        activeBudgetPeriod: null,
        totalSpent: 0,
        totalBudget: 10000000,
        currencyCode: "VND",
        isLoading: false,
        selectedMonthDate: new Date(),
      });
    } catch (e) {
      console.warn("Could not reset ExpenseStore:", e);
    }

    try {
      const postStore = usePostStore.getState();
      if (postStore.subscriptionChannel) {
        supabase.removeChannel(postStore.subscriptionChannel);
      }
      usePostStore.setState({
        posts: [],
        isLoading: false,
        errorMessage: null,
        subscriptionChannel: null,
      });
    } catch (e) {
      console.warn("Could not reset PostStore:", e);
    }

    try {
      useCircleStore.setState({
        myCircle: null,
        members: [],
        isLoading: false,
        errorMessage: null,
      });
    } catch (e) {
      console.warn("Could not reset CircleStore:", e);
    }
  },
}));

// =============================================
// POSTS STORE (CIRCLE SHARING)
// =============================================
interface PostState {
  posts: Post[];
  isLoading: boolean;
  errorMessage: string | null;
  subscriptionChannel: any | null;
  
  fetchPosts: (circleId: string | null, userId?: string) => Promise<void>;
  uploadPost: (authorId: string, circleId: string | null, localUri: string, caption: string) => Promise<Post | null>;
  subscribeRealtime: (circleId: string | null, userId?: string) => void;
  unsubscribeRealtime: () => void;
  deletePost: (id: string) => Promise<boolean>;
  updatePost: (id: string, caption: string, categoryId: string | null, amount: number | null) => Promise<boolean>;
}

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  isLoading: false,
  errorMessage: null,
  subscriptionChannel: null,

  fetchPosts: async (circleId, userId) => {
    set({ isLoading: true });
    
    let query = supabase.from("posts").select(`
      id,
      author_id,
      circle_id,
      photo_url,
      thumbnail_url,
      caption,
      has_expense,
      created_at,
      profiles:profiles!posts_author_id_fkey (
        display_name,
        username
      ),
      expenses (
        id,
        amount,
        category_id,
        expense_categories (
          id,
          name,
          icon,
          color
        )
      )
    `);
    
    if (circleId) {
      query = query.eq("circle_id", circleId);
    } else if (userId) {
      query = query.eq("author_id", userId).is("circle_id", null);
    } else {
      set({ posts: [], isLoading: false });
      return;
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      set({ errorMessage: error.message, isLoading: false });
    } else {
      const formattedPosts = (data || []).map((post: any) => {
        let profileObj = null;
        if (Array.isArray(post.profiles)) {
          profileObj = post.profiles[0] || null;
        } else {
          profileObj = post.profiles || null;
        }

        let expObj = null;
        if (Array.isArray(post.expenses)) {
          expObj = post.expenses[0] || null;
        } else {
          expObj = post.expenses || null;
        }

        return {
          id: post.id,
          author_id: post.author_id,
          circle_id: post.circle_id,
          photo_url: post.photo_url,
          thumbnail_url: post.thumbnail_url,
          caption: post.caption,
          has_expense: post.has_expense,
          created_at: post.created_at,
          profiles: profileObj,
          expense: expObj,
        };
      });
      set({ posts: formattedPosts, isLoading: false });
    }
  },

  uploadPost: async (authorId, circleId, localUri, caption) => {
    set({ isLoading: true, errorMessage: null });

    // UUID generator declared first to avoid hoisting issues
    const generateUUID = () =>
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

    try {
      // 1. Read file as Base64 string and convert to ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);

      const fileName = `${generateUUID()}.jpg`;
      const path = `posts/${authorId}/${fileName}`;

      // 2. Upload to 'posts' bucket
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(path, arrayBuffer, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 3. Get permanent public URL (no expiry)
      const { data: publicData } = supabase.storage
        .from("posts")
        .getPublicUrl(path);

      const photoUrl = publicData.publicUrl;

      // 4. Insert into DB
      const { data: newPost, error: dbError } = await supabase
        .from("posts")
        .insert({
          author_id: authorId,
          circle_id: circleId || null,
          photo_url: photoUrl,
          thumbnail_url: photoUrl,
          caption: caption || null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      let hasExpense = false;

      // Invoke parse-expense Edge Function if caption is provided
      if (caption && caption.trim()) {
        try {
          const { data: parseData, error: parseError } = await supabase.functions.invoke("parse-expense", {
            body: {
              post_id: newPost.id,
              caption: caption,
              author_id: authorId,
              circle_id: circleId || null,
            },
          });

          if (!parseError && parseData?.logged) {
            hasExpense = true;
            // Fetch dashboard data to update the balance immediately
            (async () => {
              try {
                await useExpenseStore.getState().fetchDashboardData(authorId);
              } catch (err) {
                console.warn("Failed to update dashboard data after parse-expense:", err);
              }
            })();
          }
        } catch (parseErr) {
          console.warn("Error calling parse-expense edge function:", parseErr);
        }
      }

      // Fetch user profile to populate profiles relation locally
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", authorId)
        .single();

      const formattedPost: Post = {
        id: newPost.id,
        author_id: newPost.author_id,
        circle_id: newPost.circle_id,
        photo_url: newPost.photo_url,
        thumbnail_url: newPost.thumbnail_url,
        caption: newPost.caption,
        has_expense: hasExpense,
        created_at: newPost.created_at,
        profiles: profileData || { display_name: "Tôi", username: "" },
      };

      set((state) => {
        if (state.posts.some((p) => p.id === formattedPost.id)) {
          return { isLoading: false };
        }
        return {
          posts: [formattedPost, ...state.posts],
          isLoading: false,
        };
      });

      return formattedPost;
    } catch (err: any) {
      set({ errorMessage: err.message, isLoading: false });
      return null;
    }
  },

  subscribeRealtime: (circleId, userId) => {
    get().unsubscribeRealtime();

    let filter = "";
    if (circleId) {
      filter = `circle_id=eq.${circleId}`;
    } else if (userId) {
      filter = `author_id=eq.${userId}`;
    } else {
      return;
    }

    const channel = supabase
      .channel(`realtime:public:posts:${filter}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: filter },
        (payload) => {
          const newPost = payload.new as Post;
          const currentPosts = get().posts;
          if (!currentPosts.find(p => p.id === newPost.id)) {
            // Fetch profile for the new post to show correctly in feed
            Promise.resolve(
              supabase
                .from("profiles")
                .select("display_name, username")
                .eq("id", newPost.author_id)
                .single()
            )
              .then(({ data: profileData }) => {
                const postWithProfile: Post = {
                  ...newPost,
                  profiles: profileData || { display_name: "Thành viên", username: "" }
                };
                set((state) => {
                  if (state.posts.some(p => p.id === postWithProfile.id)) {
                    return state;
                  }
                  return {
                    posts: [postWithProfile, ...state.posts]
                  };
                });
              })
              .catch(() => {
                set((state) => {
                  if (state.posts.some(p => p.id === newPost.id)) {
                    return state;
                  }
                  return {
                    posts: [newPost, ...state.posts]
                  };
                });
              });
          }
        }
      )
      .subscribe();

    set({ subscriptionChannel: channel });
  },

  unsubscribeRealtime: () => {
    const channel = get().subscriptionChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ subscriptionChannel: null });
    }
  },

  deletePost: async (id) => {
    set({ isLoading: true, errorMessage: null });
    try {
      // 1. Delete associated expense
      const { error: expError } = await supabase
        .from("expenses")
        .delete()
        .eq("post_id", id);
      if (expError) throw expError;

      // 2. Delete the post itself
      const { error: postError } = await supabase
        .from("posts")
        .delete()
        .eq("id", id);
      if (postError) throw postError;

      // 3. Remove post locally
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== id),
        isLoading: false,
      }));

      // 4. Refresh dashboard to update the balance
      const profile = useAuthStore.getState().profile;
      if (profile) {
        useExpenseStore.getState().fetchDashboardData(profile.id).catch(err => {
          console.warn("Failed to refresh dashboard data after deleting post:", err);
        });
      }

      return true;
    } catch (err: any) {
      set({ errorMessage: err.message, isLoading: false });
      return false;
    }
  },

  updatePost: async (id, caption, categoryId, amount) => {
    set({ isLoading: true, errorMessage: null });
    try {
      const hasExpense = amount !== null && amount > 0;

      // 1. Update the post's caption and has_expense flag
      const { error: postError } = await supabase
        .from("posts")
        .update({
          caption: caption || null,
          has_expense: hasExpense,
        })
        .eq("id", id);
      if (postError) throw postError;

      // 2. Update/create/delete the associated expense
      const profile = useAuthStore.getState().profile;
      if (profile) {
        if (hasExpense) {
          // Check if there is already an expense for this post
          const { data: existingExpense } = await supabase
            .from("expenses")
            .select("id")
            .eq("post_id", id)
            .maybeSingle();

          if (existingExpense) {
            // Update existing expense
            const { error: expError } = await supabase
              .from("expenses")
              .update({
                amount: Math.round(amount!),
                category_id: categoryId,
                description: caption || null,
                expense_date: new Date().toISOString().split("T")[0],
              })
              .eq("id", existingExpense.id);
            if (expError) throw expError;
          } else {
            // Create a new expense
            const { error: expError } = await supabase
              .from("expenses")
              .insert({
                user_id: profile.id,
                post_id: id,
                amount: Math.round(amount!),
                category_id: categoryId,
                description: caption || null,
                source: "auto",
                expense_date: new Date().toISOString().split("T")[0],
              });
            if (expError) throw expError;
          }
        } else {
          // Delete any existing expense if amount is cleared
          const { error: expError } = await supabase
            .from("expenses")
            .delete()
            .eq("post_id", id);
          if (expError) throw expError;
        }

        // Refresh dashboard data to update the balance
        await useExpenseStore.getState().fetchDashboardData(profile.id);
      }

      // 3. Update post locally in the state
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === id ? { ...p, caption: caption || null, has_expense: hasExpense } : p
        ),
        isLoading: false,
      }));

      return true;
    } catch (err: any) {
      set({ errorMessage: err.message, isLoading: false });
      return false;
    }
  },
}));

// =============================================
// EXPENSE STORE
// =============================================
interface ExpenseState {
  expenses: Expense[];
  categories: ExpenseCategory[];
  activeBudgetPeriod: BudgetPeriod | null;
  totalSpent: number;
  totalBudget: number;
  currencyCode: string;
  isLoading: boolean;
  selectedMonthDate: Date;
  
  fetchDashboardData: (userId: string, monthDate?: Date) => Promise<void>;
  createExpense: (userId: string, amount: number, description: string, categoryId: string | null, date: Date) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<void>;
  addCategory: (userId: string, name: string, icon: string, color: string) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  categories: [],
  activeBudgetPeriod: null,
  totalSpent: 0,
  totalBudget: 10000000,
  currencyCode: "VND",
  isLoading: false,
  selectedMonthDate: new Date(),

  fetchDashboardData: async (userId, monthDate) => {
    const targetMonth = monthDate || get().selectedMonthDate || new Date();
    set({ isLoading: true, selectedMonthDate: targetMonth });
    
    const startYear = targetMonth.getFullYear();
    const startMonthVal = targetMonth.getMonth();
    const dateStr = `${startYear}-${String(startMonthVal + 1).padStart(2, "0")}-01`;

    const endOfMonth = new Date(startYear, startMonthVal + 1, 0);
    const endDateStr = `${startYear}-${String(startMonthVal + 1).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

    const { data: cats } = await supabase
      .from("expense_categories")
      .select()
      .or(`user_id.eq.${userId},is_default.eq.true`);

    const { data: exps } = await supabase
      .from("expenses")
      .select()
      .eq("user_id", userId)
      .gte("expense_date", dateStr)
      .lte("expense_date", endDateStr)
      .order("expense_date", { ascending: false });

    const { data: budget } = await supabase
      .from("budget_periods")
      .select()
      .eq("user_id", userId)
      .eq("period_start", dateStr)
      .maybeSingle();

    const currentCategories = cats || [];
    const currentExpenses = exps || [];
    
    const currentSpent = budget?.total_spent ?? currentExpenses.reduce((sum, e) => sum + e.amount, 0);

    set({
      categories: currentCategories,
      expenses: currentExpenses,
      activeBudgetPeriod: budget || null,
      totalSpent: currentSpent,
      totalBudget: budget?.total_budget ?? 10000000,
      currencyCode: budget?.currency ?? "VND",
      isLoading: false
    });
  },

  createExpense: async (userId, amount, description, categoryId, date) => {
    set({ isLoading: true });
    const dateStr = date.toISOString().split("T")[0];

    const { error } = await supabase
      .from("expenses")
      .insert({
        user_id: userId,
        amount: Math.round(amount),
        currency: "VND",
        description: description || null,
        category_id: categoryId,
        source: "manual",
        expense_date: dateStr
      });

    if (error) {
      set({ isLoading: false });
      return false;
    }

    await get().fetchDashboardData(userId);
    return true;
  },

  deleteExpense: async (id) => {
    set({ isLoading: true });
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      set({ isLoading: false });
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await get().fetchDashboardData(user.id);
    }
  },

  addCategory: async (userId, name, icon, color) => {
    set({ isLoading: true });
    const { error } = await supabase
      .from('expense_categories')
      .insert({
        user_id: userId,
        name,
        icon,
        color,
        is_default: false,
      });

    if (error) {
      set({ isLoading: false });
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) await get().fetchDashboardData(user.id);
    return true;
  },

  deleteCategory: async (id) => {
    await supabase.from('expense_categories').delete().eq('id', id);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await get().fetchDashboardData(user.id);
  },
}));

// =============================================
// CIRCLES STORE
// =============================================
interface CircleState {
  myCircle: Circle | null;
  members: (CircleMember & { profiles: Profile })[];
  isLoading: boolean;
  errorMessage: string | null;
  
  fetchMyCircle: (userId: string) => Promise<void>;
  createCircle: (userId: string, name: string) => Promise<boolean>;
  joinCircle: (userId: string, inviteCode: string) => Promise<boolean>;
}

export const useCircleStore = create<CircleState>((set, get) => ({
  myCircle: null,
  members: [],
  isLoading: false,
  errorMessage: null,

  fetchMyCircle: async (userId) => {
    set({ isLoading: true, errorMessage: null });
    
    // Find circle user is a member of
    const { data: memberRow, error: memberError } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId)
      .maybeSingle();
      
    if (memberError) {
      set({ errorMessage: memberError.message, isLoading: false });
      return;
    }
    
    if (memberRow) {
      // Fetch circle details
      const { data: circle, error: circleError } = await supabase
        .from("circles")
        .select()
        .eq("id", memberRow.circle_id)
        .single();
        
      if (circleError) {
        set({ errorMessage: circleError.message, isLoading: false });
        return;
      }
      
      // Fetch members with profiles
      const { data: members, error: membersError } = await supabase
        .from("circle_members")
        .select(`
          circle_id,
          user_id,
          role,
          joined_at,
          profiles:profiles (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("circle_id", memberRow.circle_id);
        
      if (membersError) {
        set({ errorMessage: membersError.message, isLoading: false });
        return;
      }
      
      set({
        myCircle: circle,
        members: members as any,
        isLoading: false
      });
    } else {
      set({ myCircle: null, members: [], isLoading: false });
    }
  },

  createCircle: async (userId, name) => {
    set({ isLoading: true, errorMessage: null });
    
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .insert({
        name,
        owner_id: userId
      })
      .select()
      .single();
      
    if (circleError) {
      set({ errorMessage: circleError.message, isLoading: false });
      return false;
    }
    
    const { error: memberError } = await supabase
      .from("circle_members")
      .insert({
        circle_id: circle.id,
        user_id: userId,
        role: "owner"
      });
      
    if (memberError) {
      set({ errorMessage: memberError.message, isLoading: false });
      return false;
    }
    
    await get().fetchMyCircle(userId);
    return true;
  },

  joinCircle: async (userId, inviteCode) => {
    set({ isLoading: true, errorMessage: null });
    
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select()
      .eq("invite_code", inviteCode.trim())
      .maybeSingle();
      
    if (circleError) {
      set({ errorMessage: circleError.message, isLoading: false });
      return false;
    }
    
    if (!circle) {
      set({ errorMessage: "Mã mời không tồn tại hoặc đã hết hạn", isLoading: false });
      return false;
    }
    
    const { error: memberError } = await supabase
      .from("circle_members")
      .insert({
        circle_id: circle.id,
        user_id: userId,
        role: "member"
      });
      
    if (memberError) {
      set({ errorMessage: "Bạn đã tham gia nhóm này hoặc có lỗi xảy ra", isLoading: false });
      return false;
    }
    
    await get().fetchMyCircle(userId);
    return true;
  },
}));
