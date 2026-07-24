import { useEffect, useState } from "react";

import { getNodsReceived, nodLabel, type NodCounts } from "../services/nods";

export function useNodsReceived(userId?: string | null): { label: string; count: number }[] {
  const [nods, setNods] = useState<NodCounts>({});
  useEffect(() => {
    if (!userId) {
      setNods({});
      return;
    }
    let alive = true;
    void getNodsReceived(userId).then((n) => {
      if (alive) setNods(n);
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  return Object.entries(nods)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ label: nodLabel(id), count }));
}
