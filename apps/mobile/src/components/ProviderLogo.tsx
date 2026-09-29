import type { Provider } from "@canape/shared";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../constants/theme";

interface Props {
  provider: Provider | undefined;
  size?: number;
  dimmed?: boolean;
}

export function ProviderLogo({ provider, size = 24, dimmed = false }: Props) {
  // Flattened: expo-image on web doesn't accept nested/falsy style arrays.
  const style = StyleSheet.flatten([
    styles.base,
    { width: size, height: size, borderRadius: size * 0.22 },
    dimmed && styles.dimmed,
  ]);
  if (provider?.logoUrl) {
    return <Image source={provider.logoUrl} style={style} accessibilityLabel={provider.name} />;
  }
  return (
    <View style={[style, styles.placeholder]}>
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>{provider?.name.charAt(0) ?? "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceRaised },
  dimmed: { opacity: 0.35 },
  placeholder: { alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  initial: { color: colors.text, fontWeight: "700" },
});
