import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, type ComponentProps } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { colors, fonts, motion, radius, spacing } from "../constants/theme";
import { PressableScale } from "./motion";

interface Props {
  label: string;
  selected?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Small counter on the right (e.g. active filters). */
  count?: number;
  onPress: () => void;
}

export function Chip({ label, selected = false, icon, count, onPress }: Props) {
  // Colours can't use the native driver: the cross-fade runs in JS, it's tiny.
  const on = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(on, { toValue: selected ? 1 : 0, duration: motion.fast, useNativeDriver: false }).start();
  }, [on, selected]);
  const backgroundColor = on.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.primary] });
  const borderColor = on.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.primary] });
  const foreground = selected ? colors.primaryText : colors.text;

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" aria-selected={selected} pressedScale={0.93}>
      <Animated.View style={[styles.chip, { backgroundColor, borderColor }]}>
        {icon ? <Ionicons name={icon} size={14} color={foreground} /> : null}
        <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
        {count ? (
          <Text style={[styles.count, selected && styles.countSelected]}>{count}</Text>
        ) : null}
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { color: colors.text, fontSize: 13, fontFamily: fonts.semibold },
  selectedLabel: { color: colors.primaryText, fontFamily: fonts.bold },
  count: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 18,
    fontFamily: fonts.extrabold,
    color: colors.primaryText,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs / 2,
  },
  countSelected: { color: colors.primary, backgroundColor: colors.primaryText },
});
