import { useEffect, useMemo, useState } from "react";

import { useCached } from "../cache";
import { getQueueItems, subscribeQueue, type QueueItem } from "../services/captureQueue";
import { ARCHIVE_KEY, fetchArchive, rowMatchesQueued, queuedToItem, type Archive } from "../services/archive";

const ARCHIVE_TTL_MS = 5 * 60_000;

export function useArchive() {
  const { data, loading, error, refresh } = useCached<Archive>(ARCHIVE_KEY, fetchArchive, ARCHIVE_TTL_MS);

  const [pending, setPending] = useState<QueueItem[]>(() => [...getQueueItems()]);
  useEffect(() => {
    const unsubscribe = subscribeQueue((event) => {
      setPending([...getQueueItems()]);
      if (event.type === "done" || event.type === "duplicate") void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const merged = useMemo<Archive | null>(() => {
    if (!data) return data;
    const queued = pending
      .filter((q) => q.status !== "blocked")
      .filter((q) => !data.items.some((db) => rowMatchesQueued(db.thumbPath, q)))
      .map(queuedToItem);
    if (queued.length === 0) return data;
    const items = [...queued, ...data.items].sort(
      (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
    );
    return { ...data, items };
  }, [data, pending]);

  return { data: merged, loading, error, refresh };
}
