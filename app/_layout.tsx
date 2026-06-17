import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "../src/core/store";
import { StatusBar } from "expo-status-bar";
import { THEME } from "../src/core/theme";
import * as Linking from "expo-linking";
import { supabase } from "../src/core/supabaseClient";

function NavigationProvider() {
  const user = useAuthStore((state) => state.user);
  const isOnboarding = useAuthStore((state) => state.isOnboarding);
  const isLoading = useAuthStore((state) => state.isLoading);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if ((!user || isOnboarding) && inAuthGroup) {
      router.replace("/login");
    } else if (user && !isOnboarding && !inAuthGroup) {
      router.replace("/(tabs)/feed");
    }
  }, [user, isOnboarding, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();

    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      if (url && url.includes("access_token")) {
        const getParam = (name: string) => {
          const regex = new RegExp(`[#?&]${name}=([^&#]*)`);
          const match = url.match(regex);
          return match ? decodeURIComponent(match[1]) : null;
        };

        const accessToken = getParam("access_token");
        const refreshToken = getParam("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            await checkSession();
          }
        }
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <NavigationProvider />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: THEME.backgroundPrimary },
        }}
      />
    </>
  );
}
