import { Platform } from "react-native";

/** Catppuccin Frappé — https://catppuccin.com/palette */
export const frappe = {
  rosewater: "#f2d5cf",
  flamingo: "#eebebe",
  pink: "#f4b8e4",
  mauve: "#ca9ee6",
  red: "#e78284",
  maroon: "#ea999c",
  peach: "#ef9f76",
  yellow: "#e5c890",
  green: "#a6d189",
  teal: "#81c8be",
  sky: "#99d1db",
  sapphire: "#85c1dc",
  blue: "#8caaee",
  lavender: "#babbf1",
  text: "#c6d0f5",
  subtext1: "#b5bfe2",
  subtext0: "#a5adce",
  overlay2: "#949cbb",
  overlay1: "#838ba7",
  overlay0: "#737994",
  surface2: "#626880",
  surface1: "#51576d",
  surface0: "#414559",
  base: "#303446",
  mantle: "#292c3c",
  crust: "#232634",
} as const;

export const colors = {
  background: frappe.mantle,
  /** Deepest layer: navigation dock, sheets' backdrop tint. */
  backgroundDeep: frappe.crust,
  surface: frappe.base,
  surfaceRaised: frappe.surface0,
  border: frappe.surface0,
  borderStrong: frappe.surface1,
  text: frappe.text,
  textMuted: frappe.subtext0,
  textFaint: frappe.overlay1,
  primary: frappe.mauve,
  primaryText: frappe.crust,
  accent: frappe.peach,
  success: frappe.green,
  warning: frappe.yellow,
  danger: frappe.red,
} as const;

/** Adds transparency to a #rrggbb colour. */
export function alpha(hex: string, opacity: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

/** The signature "golden hour" gradient: main actions, the match moment, the logo glow. */
export const gradients = {
  brand: [frappe.mauve, frappe.pink, frappe.peach] as const,
  brandSoft: [alpha(frappe.mauve, 0.22), alpha(frappe.pink, 0.12)] as const,
};

/**
 * Fraunces (warm serif) for titles, Manrope for everything else. Each weight is
 * its own family: never combine with `fontWeight` (it would fake bold on the web).
 */
export const fonts = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_600SemiBold_Italic",
  regular: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;
export const radius = { sm: 8, md: 14, lg: 22, xl: 30, pill: 999 } as const;

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  /** Delay between two items of a list appearing one after the other. */
  stagger: 45,
  spring: { damping: 16, stiffness: 220, mass: 0.9 },
  /** The native driver doesn't exist on the web. */
  native: Platform.OS !== "web",
} as const;
