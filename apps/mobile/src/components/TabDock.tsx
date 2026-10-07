import type { BottomTabBarProps } from "expo-router/tabs";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha, colors, fonts, motion, radius, spacing } from "../constants/theme";
import { useReducedMotion } from "./motion";

/** Height of one item in the vertical (wide screen) rail. */
const RAIL_ITEM = 50;

/**
 * Navigation: a floating dock on phones, a rail with the wordmark on wide
 * screens. A soft highlight glides to the active tab instead of jumping.
 */
export function TabDock({ state, descriptors, navigation, vertical }: BottomTabBarProps & { vertical: boolean }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [itemWidth, setItemWidth] = useState(0);
  const position = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    if (reduced) position.setValue(state.index);
    else Animated.spring(position, { toValue: state.index, ...motion.spring, useNativeDriver: motion.native }).start();
  }, [state.index, position, reduced]);

  const onDockLayout = (e: LayoutChangeEvent) =>
    setItemWidth((e.nativeEvent.layout.width - DOCK_PADDING * 2) / state.routes.length);

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const label = options.title ?? route.name;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return (
      <DockItem
        key={route.key}
        label={label}
        focused={focused}
        vertical={vertical}
        onPress={onPress}
        renderIcon={(color) => options.tabBarIcon?.({ focused, color, size: 22 })}
      />
    );
  });

  if (vertical) {
    return (
      <View style={[styles.rail, { paddingTop: insets.top + spacing.xxl }]}>
        <Text style={styles.wordmark} accessibilityRole="header" aria-level={1}>
          Canap<Text style={styles.wordmarkAccent}>é</Text>
        </Text>
        <View role="tablist">
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              styles.railHighlight,
              {
                transform: [
                  {
                    translateY: position.interpolate({
                      inputRange: [0, Math.max(1, state.routes.length - 1)],
                      outputRange: [0, Math.max(1, state.routes.length - 1) * RAIL_ITEM],
                    }),
                  },
                ],
              },
            ]}
          />
          {items}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.dock} onLayout={onDockLayout} role="tablist">
        {itemWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              styles.dockHighlight,
              {
                width: itemWidth,
                transform: [
                  {
                    translateX: position.interpolate({
                      inputRange: [0, Math.max(1, state.routes.length - 1)],
                      outputRange: [0, Math.max(1, state.routes.length - 1) * itemWidth],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
        {items}
      </View>
    </View>
  );
}

function DockItem({
  label,
  focused,
  vertical,
  onPress,
  renderIcon,
}: {
  label: string;
  focused: boolean;
  vertical: boolean;
  onPress: () => void;
  renderIcon: (color: string) => React.ReactNode;
}) {
  const pop = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  // A small "pop" of the icon when its tab becomes active.
  useEffect(() => {
    if (!focused || reduced) return;
    pop.setValue(0.82);
    Animated.spring(pop, { toValue: 1, damping: 9, stiffness: 260, mass: 0.7, useNativeDriver: motion.native }).start();
  }, [focused, pop, reduced]);
  const color = focused ? colors.primary : colors.textFaint;

  return (
    <Pressable
      onPress={onPress}
      role="tab"
      aria-selected={focused}
      accessibilityLabel={label}
      style={vertical ? styles.railItem : styles.dockItem}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>{renderIcon(color)}</Animated.View>
      <Text
        numberOfLines={1}
        style={[vertical ? styles.railLabel : styles.dockLabel, { color: focused ? colors.text : colors.textFaint }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const DOCK_PADDING = 6;

const styles = StyleSheet.create({
  dockWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, backgroundColor: colors.background },
  dock: {
    flexDirection: "row",
    padding: DOCK_PADDING,
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundDeep,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  highlight: { position: "absolute", backgroundColor: alpha(colors.primary, 0.16) },
  dockHighlight: { top: DOCK_PADDING, bottom: DOCK_PADDING, left: DOCK_PADDING, borderRadius: radius.lg },
  dockItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: spacing.sm },
  dockLabel: { fontSize: 11, lineHeight: 14, fontFamily: fonts.bold },

  rail: {
    width: 240,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    backgroundColor: colors.backgroundDeep,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  wordmark: {
    color: colors.primary,
    fontSize: 34,
    fontFamily: fonts.displayItalic,
    paddingHorizontal: spacing.md,
    letterSpacing: -0.5,
  },
  wordmarkAccent: { color: colors.accent },
  railHighlight: { top: 0, left: 0, right: 0, height: RAIL_ITEM, borderRadius: radius.md },
  railItem: {
    height: RAIL_ITEM,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  railLabel: { fontSize: 15, fontFamily: fonts.bold },
});
