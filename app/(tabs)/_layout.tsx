import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { THEME } from "../../src/core/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: THEME.backgroundPrimary,
          borderTopColor: THEME.borderSecondary,
          height: 62,
          paddingBottom: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: THEME.textPrimary,
        tabBarInactiveTintColor: THEME.textTertiary,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expense"
        options={{
          title: "Expense",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: "Camera",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "camera" : "camera-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
