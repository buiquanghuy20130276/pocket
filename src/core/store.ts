import { create } from "zustand";
import { supabase } from "./supabaseClient";

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
  photo_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  has_expense: boolean;
  created_at: string;
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

// =============================================
// AUTH STORE
// =============================================
interface AuthState {
  user: any | null;
  profile: Profile | null;
  isLoading: boolean;
  errorMessage: string | null;
  isOTPSent: boolean;
  isOnboarding: boolean;
  
  checkSession: () => Promise<void>;
  signInWithOTP: (phone: string) => Promise<void>;
  verifyOTP: (phone: string, token: string) => Promise<void>;
  saveProfile: (username: string, displayName: string) => Promise<void>;
  updateFCMToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,
  errorMessage: null,
  isOTPSent: false,
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

      set({ user, profile, isLoading: false, isOnboarding: !profile });
    } else {
      set({ user: null, profile: null, isLoading: false });
    }
  },

  signInWithOTP: async (phone) => {
    set({ isLoading: true, errorMessage: null });
    const { error } = await supabase.auth.signInWithOTP({ phone });
    if (error) {
      set({ errorMessage: error.message, isLoading: false });
    } else {
      set({ isOTPSent: true, isLoading: false });
    }
  },

  verifyOTP: async (phone, token) => {
    set({ isLoading: true, errorMessage: null });
    const { data: { session }, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (error) {
      set({ errorMessage: error.message, isLoading: false });
      return;
    }

    if (session) {
      const user = session.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select()
        .eq("id", user.id)
        .maybeSingle();

      set({
        user,
        profile,
        isLoading: false,
        isOnboarding: !profile,
      });
    }
  },

  saveProfile: async (username, displayName) => {
    const user = get().user;
    if (!user) return;
    set({ isLoading: true, errorMessage: null });

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

    if (error) {
      set({ errorMessage: error.message, isLoading: false });
    } else {
      set({ profile: data, isOnboarding: false, isLoading: false });
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
    set({ user: null, profile: null, isOTPSent: false, isOnboarding: false });
  },
}));

// =============================================
// POSTS STORE (PERSONAL ONLY)
// =============================================
interface PostState {
  posts: Post[];
  isLoading: boolean;
  errorMessage: string | null;
  subscriptionChannel: any | null;
  
  fetchPosts: (userId: string) => Promise<void>;
  uploadPost: (authorId: string, localUri: string, caption: string) => Promise<Post | null>;
  subscribeRealtime: (userId: string) => void;
  unsubscribeRealtime: () => void;
}

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  isLoading: false,
  errorMessage: null,
  subscriptionChannel: null,

  fetchPosts: async (userId) => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from("posts")
      .select()
      .eq("author_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      set({ errorMessage: error.message, isLoading: false });
    } else {
      set({ posts: data || [], isLoading: false });
    }
  },

  uploadPost: async (authorId, localUri, caption) => {
    set({ isLoading: true, errorMessage: null });

    try {
      // 1. Read file bytes/Blob for upload
      const response = await fetch(localUri);
      const blob = await response.blob();
      
      const path = `posts/${authorId}/${UUID()}.jpg`;

      // Helper function to generate UUID in JS
      function UUID() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
          var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }

      // 2. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(path, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600"
        });

      if (uploadError) throw uploadError;

      // 3. Create signed URL (valid 1 hour)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("posts")
        .createSignedUrl(path, 3600);

      if (signedError || !signedData) throw signedError || new Error("Failed to sign URL");

      const photoUrl = signedData.signedUrl;

      // 4. Insert database post (personal posts, circle_id is null)
      const { data: newPost, error: dbError } = await supabase
        .from("posts")
        .insert({
          author_id: authorId,
          circle_id: null,
          photo_url: photoUrl,
          thumbnail_url: photoUrl,
          caption: caption || null
        })
        .select()
        .single();

      if (dbError) throw dbError;

      set({ isLoading: false });
      return newPost;

    } catch (err: any) {
      set({ errorMessage: err.message, isLoading: false });
      return null;
    }
  },

  subscribeRealtime: (userId) => {
    get().unsubscribeRealtime();

    const channel = supabase
      .channel(`realtime:public:posts:author_id=eq.${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          const newPost = payload.new as Post;
          const currentPosts = get().posts;
          if (!currentPosts.find(p => p.id === newPost.id)) {
            set({ posts: [newPost, ...currentPosts] });
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
  
  fetchDashboardData: (userId: string) => Promise<void>;
  createExpense: (userId: string, amount: number, description: string, categoryId: string | null, date: Date) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  categories: [],
  activeBudgetPeriod: null,
  totalSpent: 0,
  totalBudget: 10000000,
  currencyCode: "VND",
  isLoading: false,

  fetchDashboardData: async (userId) => {
    set({ isLoading: true });
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const dateStr = startOfMonth.toISOString().split("T")[0];

    const { data: cats } = await supabase
      .from("expense_categories")
      .select()
      .or(`user_id.eq.${userId},is_default.eq.true`);

    const { data: exps } = await supabase
      .from("expenses")
      .select()
      .eq("user_id", userId)
      .order("expense_date", { ascending: false });

    const { data: budget } = await supabase
      .from("budget_periods")
      .select()
      .eq("user_id", userId)
      .eq("period_start", dateStr)
      .maybeSingle();

    const currentCategories = cats || [];
    const currentExpenses = exps || [];
    
    const startM = new Date();
    startM.setDate(1);
    startM.setHours(0,0,0,0);
    const currentSpent = budget?.total_spent ?? currentExpenses
      .filter(e => new Date(e.expense_date) >= startM)
      .reduce((sum, e) => sum + e.amount, 0);

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
}));
