import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Using Expo-supported process env variables (loaded via EXPO_PUBLIC_ prefix in .env)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
