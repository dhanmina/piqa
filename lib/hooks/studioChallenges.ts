import { useEffect } from "react";

import { fetchKey, revalidate } from "../cache";
import { subscribeQueue } from "../services/captureQueue";
import { fetchStudioChallenge, STUDIO_CHALLENGE_KEY, type StudioChallenge } from "../services/studioChallenges";
import { useCached } from "./useCache";

const STUDIO_CHALLENGE_TTL_MS = 60_000;

export function useStudioChallenge() {
  const { data, loading, error, refresh } = useCached<StudioChallenge | null>(
    STUDIO_CHALLENGE_KEY,
    fetchStudioChallenge,
    STUDIO_CHALLENGE_TTL_MS,
  );

  useEffect(() => {
    const unsubscribe = subscribeQueue((event) => {
      if ((event.type === "done" || event.type === "duplicate") && event.item.kind === "studio_challenge") {
        revalidate(STUDIO_CHALLENGE_KEY);
        void fetchKey(STUDIO_CHALLENGE_KEY, fetchStudioChallenge);
      }
    });
    return unsubscribe;
  }, []);

  return { data, loading, error, refresh };
}
