import { useWindowDimensions, type ViewStyle } from "react-native";

/** From this width (desktop browser, tablet) the app switches to a side navigation and a centred column. */
export const WIDE_BREAKPOINT = 900;
export const CONTENT_MAX_WIDTH = 760;
export const FORM_MAX_WIDTH = 440;

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

/** Centres a block in the page, capped at `maxWidth` (full width on phones). */
export function centered(maxWidth = CONTENT_MAX_WIDTH): ViewStyle {
  return { width: "100%", maxWidth, alignSelf: "center" };
}
