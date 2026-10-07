import "../i18n"; // initialise translations before any screen renders
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_600SemiBold_Italic } from "@expo-google-fonts/fraunces/600SemiBold_Italic";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Analytics } from "../components/Analytics";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Seo } from "../components/Seo";
import { colors, fonts } from "../constants/theme";
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

/** Only the weights the theme uses (each one is a ~90 KB download on the web). */
const FONT_FILES = {
  [fonts.display]: Fraunces_600SemiBold,
  [fonts.displayItalic]: Fraunces_600SemiBold_Italic,
  [fonts.regular]: Manrope_500Medium,
  [fonts.semibold]: Manrope_600SemiBold,
  [fonts.bold]: Manrope_700Bold,
  [fonts.extrabold]: Manrope_800ExtraBold,
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  // A failed font download falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  if (!fontsLoaded && !fontError) return <View style={styles.crash} />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <LanguageSync />
          <Analytics />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.bold },
              contentStyle: { backgroundColor: colors.background },
              animation: "fade_from_bottom",
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="title/[mediaType]/[id]" options={{ title: "", headerTransparent: true, animation: "slide_from_right" }} />
            <Stack.Screen name="legal/[doc]" options={{ headerShown: false }} />
            <Stack.Screen name="scan" options={{ headerShown: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="pair/[id]" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Last resort for a rendering error anywhere in the app: a message and a way
 * out instead of a blank screen (which an installed PWA can't even reload).
 * Rendered outside the providers above: no query client or theme here.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.crash}>
      <EmptyState icon="alert-circle-outline" title={t("common.crashTitle")} message={t("common.crashMessage")}>
        <Button label={t("common.retry")} onPress={() => void retry()} />
      </EmptyState>
    </View>
  );
}

const styles = StyleSheet.create({
  crash: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
});

/** Applies this device's language preference (stored with the session) to i18next. */
function LanguageSync() {
  const preference = useSession((s) => s.language);
  const { i18n, t } = useTranslation();
  useEffect(() => {
    const language = resolvePreference(preference);
    if (i18n.language !== language) void i18n.changeLanguage(language);
    // Web/PWA: screen readers and the browser's translate prompt rely on <html lang>.
    if (Platform.OS === "web" && typeof document !== "undefined") document.documentElement.lang = language;
  }, [preference, i18n]);
  // Default title / description; screens with their own <Seo> override it.
  return <Seo description={t("welcome.tagline")} />;
}
