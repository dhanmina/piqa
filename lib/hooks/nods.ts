import { useCallback } from "react";

import { useCached } from "./useCache";
import { getNodsReceived, nodLabel, type NodCounts } from "../services/nods";

export function useNodsReceived(userId?: string | null): { label: string; count: number }[] {
  const { data } = useCached<NodCounts>(
    `nods_received:${userId ?? ""}`,
    useCallback(
      () => (userId ? getNodsReceived(userId) : Promise.resolve({})),
      [userId],
    ),
    5 * 60_000,
  );
  const nods = data ?? {};
  return Object.entries(nods)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ label: nodLabel(id), count }));
}
