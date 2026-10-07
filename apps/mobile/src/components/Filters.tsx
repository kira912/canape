import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { colors, fonts, motion, radius, spacing } from "../constants/theme";
import { Chip } from "./Chip";
import { ChipRow } from "./ChipRow";
import { Reveal, useReducedMotion } from "./motion";

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Two or three mutually exclusive choices, with a thumb that slides to the selected one. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const position = useRef(new Animated.Value(index)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) position.setValue(index);
    else Animated.spring(position, { toValue: index, ...motion.spring, useNativeDriver: motion.native }).start();
  }, [index, position, reduced]);
  const segment = (width - SEGMENT_PADDING * 2) / options.length;

  return (
    <View
      style={styles.segmented}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      role="radiogroup"
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segment,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, Math.max(1, options.length - 1)],
                    outputRange: [0, Math.max(1, options.length - 1) * segment],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            role="radio"
            aria-checked={selected}
            style={styles.segment}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Filters" button: shows how many are active, opens the panel below. */
export function FiltersToggle({ open, count, onPress }: { open: boolean; count: number; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Chip
      label={t("filters.title")}
      icon={open ? "close" : "options-outline"}
      count={count}
      selected={open}
      onPress={onPress}
    />
  );
}

/** The panel of filter groups, revealed in place under the toggle. */
export function FiltersPanel({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <Reveal open={open}>
      <View style={styles.panel}>{children}</View>
    </Reveal>
  );
}

/** One labelled row of chips inside the filters panel. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <ChipRow>{children}</ChipRow>
    </View>
  );
}

const SEGMENT_PADDING = 4;

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    padding: SEGMENT_PADDING,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    position: "absolute",
    top: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    left: SEGMENT_PADDING,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9 },
  segmentLabel: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.bold },
  segmentLabelSelected: { color: colors.primaryText },
  panel: { gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  group: { gap: spacing.sm },
  groupLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: fonts.extrabold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: spacing.lg,
  },
});
