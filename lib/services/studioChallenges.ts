import { invalidate, patch } from "../cache";
import { supabase } from "./supabase";

export type StudioChallengeSubmission = {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  thumbPath: string;
  heartCount: number;
  heartedByMe: boolean;
};

export type StudioChallenge = {
  challengeId: string;
  theme: string;
  endsAt: string;
  isActive: boolean;
  mySubmissionId: string | null;
  submissions: StudioChallengeSubmission[];
};

export const STUDIO_CHALLENGE_KEY = "studioChallenge:mine";

// Mirrors the p_duration_hours in (24,72,168) check in start_studio_challenge.
export const STUDIO_CHALLENGE_DURATIONS = [
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
] as const;

type RawSubmission = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  thumb_path: string;
  heart_count: number;
  hearted_by_me: boolean;
};

type RawChallenge = {
  found: boolean;
  challenge_id: string;
  theme: string;
  ends_at: string;
  is_active: boolean;
  my_submission_id: string | null;
  submissions: RawSubmission[];
};

export async function fetchStudioChallenge(): Promise<StudioChallenge | null> {
  const { data, error } = await supabase.rpc("get_studio_challenge");
  if (error) throw error;
  const res = data as RawChallenge;
  if (!res?.found) return null;
  return {
    challengeId: res.challenge_id,
    theme: res.theme,
    endsAt: res.ends_at,
    isActive: res.is_active,
    mySubmissionId: res.my_submission_id,
    submissions: res.submissions.map((s) => ({
      id: s.id,
      userId: s.user_id,
      username: s.username,
      avatarUrl: s.avatar_url,
      thumbPath: s.thumb_path,
      heartCount: s.heart_count,
      heartedByMe: s.hearted_by_me,
    })),
  };
}

/**
 * A day-level countdown, not a ticking clock — challenges run 1-7 days, so a
 * live HH:MM:SS would read as noise (and this app ticks seconds in exactly
 * one place: the voting-close countdown, which is a same-day, urgent window).
 */
export function formatChallengeTimeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "ends in <1h";
  if (hours < 24) return `ends in ${hours}h`;
  return `ends in ${Math.round(hours / 24)}d`;
}

type Mutation = { ok: boolean; reason?: string; challenge_id?: string };

export async function startStudioChallenge(
  theme: string,
  durationHours: (typeof STUDIO_CHALLENGE_DURATIONS)[number]["hours"],
): Promise<Mutation> {
  const { data, error } = await supabase.rpc("start_studio_challenge", {
    p_theme: theme,
    p_duration_hours: durationHours,
  });
  if (error) throw error;
  if ((data as Mutation)?.ok) invalidate(STUDIO_CHALLENGE_KEY);
  return data as Mutation;
}

/**
 * Patches the cached grid in place instead of invalidating — a heart toggle
 * already knows the new count, so refetching would just blank the screen for
 * a beat and then show the same thing.
 */
export async function toggleStudioChallengeHeart(
  submissionId: string,
): Promise<{ ok: boolean; hearted?: boolean; heartCount?: number; reason?: string }> {
  const { data, error } = await supabase.rpc("toggle_studio_challenge_heart", {
    p_submission_id: submissionId,
  });
  if (error) throw error;
  const res = data as { ok: boolean; hearted?: boolean; heart_count?: number; reason?: string };
  if (res?.ok) {
    patch<StudioChallenge | null>(STUDIO_CHALLENGE_KEY, (value) => {
      if (!value) return value;
      return {
        ...value,
        submissions: value.submissions.map((s) =>
          s.id === submissionId
            ? { ...s, heartedByMe: !!res.hearted, heartCount: res.heart_count ?? s.heartCount }
            : s,
        ),
      };
    });
  }
  return { ok: res?.ok, hearted: res?.hearted, heartCount: res?.heart_count, reason: res?.reason };
}
