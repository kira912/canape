import "../i18n"; // initialise translations before any screen renders
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../constants/theme";
import { resolvePreference } from "../i18n";
import { useSession } from "../lib/household-store";

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <LanguageSync />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerTintColor: colors.text, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="title/[mediaType]/[id]" options={{ title: "", headerTransparent: true }} />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Applies this device's language preference (stored with the session) to i18next. */
function LanguageSync() {
  const preference = useSession((s) => s.language);
  const { i18n } = useTranslation();
  useEffect(() => {
    const language = resolvePreference(preference);
    if (i18n.language !== language) void i18n.changeLanguage(language);
    // Web/PWA: screen readers and the browser's translate prompt rely on <html lang>.
    if (Platform.OS === "web" && typeof document !== "undefined") document.documentElement.lang = language;
  }, [preference, i18n]);
  return null;
}
