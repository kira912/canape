import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { motion } from "../constants/theme";

/** The system "reduce motion" setting: animations then jump to their end state. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduced(value));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

interface FadeInProps {
  children: ReactNode;
  /** Position in a list: items appear one after the other (capped, so long lists don't wait). */
  index?: number;
  delay?: number;
  /** Starting vertical offset (px). */
  from?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades and slides its content in once, when mounted. */
export function FadeIn({ children, index = 0, delay = 0, from = 14, style }: FadeInProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.slow,
      delay: delay + Math.min(index, 8) * motion.stagger,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: motion.native,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, delay, index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. */
  pressedScale?: number;
  children?: ReactNode;
};

/** A Pressable that gives in slightly under the finger and springs back: every tap gets a physical answer. */
export function PressableScale({
  style,
  pressedScale = 0.96,
  onPressIn,
  onPressOut,
  children,
  ...props
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, ...motion.spring, useNativeDriver: motion.native }).start();
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        to(pressedScale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Soft pulsing placeholder while content loads. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 700, useNativeDriver: motion.native }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: motion.native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[style, { opacity: pulse }]} />;
}

/** Height-and-fade reveal for a panel that opens in place (filters, options). */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [mounted, setMounted] = useState(open);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (open) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduced ? 0 : motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: motion.native,
    });
    animation.start(({ finished }) => finished && !open && setMounted(false));
    return () => animation.stop();
  }, [open, progress, reduced]);
  if (!mounted) return null;
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
