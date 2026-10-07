import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, fonts, radius, spacing } from "../constants/theme";

/** Text input with the app's focus state (the browser outline is disabled in public/index.html). */
export const TextField = forwardRef<TextInput, TextInputProps>(function TextField(
  { style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textFaint}
      selectionColor={colors.primary}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, focused && styles.focused, style]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  focused: { borderColor: colors.primary, backgroundColor: colors.surfaceRaised },
});
