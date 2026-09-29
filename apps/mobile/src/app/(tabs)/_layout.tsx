import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/theme";
import { useSession } from "../../lib/household-store";
import { useHouseholdHydrated } from "../../lib/use-hydrated";

export default function TabsLayout() {
  const { t } = useTranslation();
  const hydrated = useHouseholdHydrated();
  const token = useSession((s) => s.token);
  const insets = useSafeAreaInsets();

  if (!hydrated) return null;
  if (!token) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          // On web the default 49px bar clips label descenders ("Foyer"); keep the home-indicator inset.
          ...(Platform.OS === "web" ? { height: 56 + insets.bottom } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14 },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.search"),
          headerTitle: t("tabs.searchHeader"),
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("tabs.discover"),
          headerTitle: t("tabs.discoverHeader"),
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("tabs.favorites"),
          headerTitle: t("tabs.favoritesHeader"),
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.household"),
          headerTitle: t("tabs.householdHeader"),
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
