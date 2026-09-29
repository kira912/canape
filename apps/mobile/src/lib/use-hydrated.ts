import { useEffect, useState } from "react";
import { useSession } from "./household-store";

/** True once the persisted session have been read from storage. */
export function useHouseholdHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSession.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useSession.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}
