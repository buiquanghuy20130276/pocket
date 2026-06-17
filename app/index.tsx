import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/core/store";
import { THEME } from "../src/core/theme";

export default function Index() {
  const { user, isLoading, isOnboarding } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={THEME.textPrimary} />
      </View>
    );
  }

  if (user) {
    if (isOnboarding) {
      return <Redirect href="/login" />;
    }
    return <Redirect href="/(tabs)/feed" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.backgroundPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
