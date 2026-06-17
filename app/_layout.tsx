import { useEffect } from "react";
import { Stack } from "expo-router";
import { useAuthStore } from "../src/core/store";
import { StatusBar } from "expo-status-bar";
import { THEME } from "../src/core/theme";

export default function RootLayout() {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: THEME.backgroundPrimary },
        }}
      />
    </>
  );
}
