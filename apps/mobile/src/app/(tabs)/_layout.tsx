import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { TabDock } from "../../components/TabDock";
import { colors } from "../../constants/theme";
import { useSession } from "../../lib/household-store";
import { useIsWide } from "../../lib/layout";
import { useIsSolo } from "../../lib/queries";
import { useHouseholdHydrated } from "../../lib/use-hydrated";

export default function TabsLayout() {
  const { t } = useTranslation();
  const hydrated = useHouseholdHydrated();
  const token = useSession((s) => s.token);
  const isWide = useIsWide();
  const solo = useIsSolo();

  if (!hydrated) return null;
  if (!token) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => <TabDock {...props} vertical={isWide} />}
      screenOptions={{
        // Each page shows its own <PageTitle>.
        headerShown: false,
        tabBarPosition: isWide ? "left" : "bottom",
        animation: isWide ? "fade" : "shift",
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.search"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("tabs.discover"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="match"
        options={{
          title: t("tabs.match"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "flame" : "flame-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("tabs.favorites"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: solo ? t("tabs.profile") : t("tabs.household"),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={solo ? (focused ? "person" : "person-outline") : focused ? "people" : "people-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
