import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LanguagePreference } from "../i18n";
import type { SavedTv } from "./tv/samsung";

/**
 * This device's session in the shared household. The household itself
 * (platforms, members, favorites) lives on the API.
 */
interface SessionState {
  token: string | null;
  memberId: string | null;
  /**
   * Platforms picked before households existed (prototype v1). Sent once
   * when creating the household, then unused.
   */
  providerIds: number[];
  /** Per device: each member may use the app in their own language. */
  language: LanguagePreference;
  setLanguage: (language: LanguagePreference) => void;
  /** This device's smart TV (same Wi-Fi), to open platforms on it. */
  tv: SavedTv | null;
  setTv: (tv: SavedTv | null) => void;
  setSession: (session: { token: string; memberId: string }) => void;
  clearSession: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      memberId: null,
      providerIds: [],
      language: "system",
      setLanguage: (language) => set({ language }),
      tv: null,
      setTv: (tv) => set({ tv }),
      setSession: ({ token, memberId }) => set({ token, memberId }),
      clearSession: () => set({ token: null, memberId: null }),
    }),
    // Same storage key as v1 so previously picked platforms are carried over.
    { name: "canape-household", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
