import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "../constants/theme";
import { useIsWide } from "../lib/layout";
import { FadeIn } from "./motion";

/**
 * Editorial page title at the top of each tab (there is no navigation header):
 * it carries the status bar inset on phones.
 */
export function PageTitle({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const insets = useSafeAreaInsets();
  const isWide = useIsWide();
  return (
    <FadeIn from={8}>
      <Text
        style={[
          styles.title,
          isWide ? styles.titleWide : { paddingTop: insets.top + spacing.lg },
          style,
        ]}
        accessibilityRole="header"
      >
        {children}
      </Text>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  titleWide: { fontSize: 40, lineHeight: 46, paddingTop: spacing.xxl },
});
