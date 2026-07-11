import { Image } from "expo-image";

import { getConfig } from "./config";
import { supabase } from "./supabase";

const SIGNED_TTL = 3600;

export type MatchupPhoto = { id: string; thumb_path: string | null };
export type MatchupSet = {
  dropId: string | null;
  remaining: number;
  capped: boolean;
  /** Signed, ready-to-render pairs. */
  pairs: { aId: string; bId: string; aUri: string | null; bUri: string | null }[];
};

type RawMatchup = {
  drop_id: string | null;
  remaining: number;
  capped: boolean;
  pairs: { a: MatchupPhoto; b: MatchupPhoto }[];
};

/**
 * Fetch one set of blind pairs, batch-sign every thumb, and warm the image
 * cache so each pair renders instantly as the curator advances (spec §14
 * "client prefetches next set's thumbnails while I judge").
 */
export async function fetchMatchupSet(): Promise<MatchupSet> {
  const { data, error } = await supabase.rpc("get_matchup");
  if (error) throw new Error(error.message);
  const raw = data as unknown as RawMatchup;

  const paths = raw.pairs
    .flatMap((p) => [p.a.thumb_path, p.b.thumb_path])
    .filter((p): p is string => !!p);

  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage.from("submissions").createSignedUrls(paths, SIGNED_TTL);
    urls?.forEach((u) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }

  const uri = (path: string | null) => (path ? (signed.get(path) ?? null) : null);
  const pairs = raw.pairs.map((p) => ({
    aId: p.a.id,
    bId: p.b.id,
    aUri: uri(p.a.thumb_path),
    bUri: uri(p.b.thumb_path),
  }));

  // Warm the cache for the whole set — upcoming pairs are then instant.
  const all = pairs.flatMap((p) => [p.aUri, p.bUri]).filter((u): u is string => !!u);
  if (all.length > 0) void Image.prefetch(all);

  return { dropId: raw.drop_id, remaining: raw.remaining, capped: raw.capped, pairs };
}

export type VoteResult = { ok: boolean; reason?: string; remaining?: number };

/**
 * Spaced, sequential vote sender. The UI advances optimistically the instant a
 * curator picks; sends are spaced ≥ the server's min interval so no pick is
 * ever rejected for being too fast (and none is silently lost). Network errors
 * retry with backoff; a duplicate/self pick is dropped quietly; hitting the cap
 * stops the queue and notifies via onCap.
 */
export function createVoteSender(onCap: () => void, onRemaining: (n: number) => void) {
  type Job = { winner: string; loser: string; drop: string };
  const queue: Job[] = [];
  let running = false;
  let lastSentAt = 0;
  let minGapMs = 2000;
  let capped = false;

  void getConfig("vote_min_interval_s").then((s) => {
    minGapMs = Math.max(0, Number(s) * 1000);
  });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function send(job: Job, attempt = 0): Promise<void> {
    const { data, error } = await supabase.rpc("cast_vote", {
      p_winner: job.winner,
      p_loser: job.loser,
      p_drop: job.drop,
    });
    if (error) {
      // Network/transient — retry a few times with backoff, then give up.
      if (attempt < 4) {
        await sleep(500 * 2 ** attempt);
        return send(job, attempt + 1);
      }
      return;
    }
    const res = data as unknown as VoteResult;
    if (res.reason === "too_fast" && attempt < 6) {
      await sleep(minGapMs);
      return send(job, attempt + 1);
    }
    if (res.reason === "cap_reached") {
      capped = true;
      onCap();
      return;
    }
    if (typeof res.remaining === "number") onRemaining(res.remaining);
  }

  async function pump() {
    if (running) return;
    running = true;
    while (queue.length > 0 && !capped) {
      const wait = minGapMs - (Date.now() - lastSentAt);
      if (wait > 0) await sleep(wait);
      const job = queue.shift()!;
      lastSentAt = Date.now();
      await send(job);
    }
    running = false;
  }

  return {
    enqueue(job: Job) {
      if (capped) return;
      queue.push(job);
      void pump();
    },
    /** Resolve once every queued vote has been sent (used before the next set). */
    async drain() {
      while ((running || queue.length > 0) && !capped) await sleep(100);
    },
    get capped() {
      return capped;
    },
  };
}
