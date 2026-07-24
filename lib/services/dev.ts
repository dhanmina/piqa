import { supabase } from "./supabase";

/**
 * Dev time-machine wrappers (spec §16). Every call hits a beta_mode-guarded
 * SECURITY DEFINER RPC — the server refuses if beta_mode is off, so these are
 * inert in production even though the buttons only render under __DEV__.
 */

export type DevStatus = {
  drop_id: string | null;
  drop_date?: string;
  status?: string;
  drops_at?: string;
  submit_closes_at?: string;
  voting_closes_at?: string;
  is_live?: boolean;
  voting_open?: boolean;
  submissions?: number;
  votes?: number;
  in_gallery?: number;
  closed?: boolean;
  potd_shooter?: string | null;
  // Phase 4 retention state
  my_submitted?: boolean;
  my_votes?: number;
  my_xp?: number;
  streak_weeks?: number;
  days_this_week?: number;
  shields?: number;
  is_alive?: boolean;
  comeback_pending?: boolean;
};

type DevRpc =
  | "dev_force_drop"
  | "dev_seed_submissions"
  | "dev_seed_votes"
  | "dev_run_close_day"
  | "dev_reset_day"
  | "dev_status"
  | "dev_grant_xp"
  | "dev_break_streak"
  | "dev_force_comeback"
  | "dev_fill_vote_cap"
  | "dev_advance_day";

async function call<T>(fn: DevRpc, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) throw new Error(error.message);
  return data as unknown as T;
}

export const devForceDrop = () => call<Record<string, unknown>>("dev_force_drop");
export const devSeedSubmissions = () => call<Record<string, unknown>>("dev_seed_submissions");
export const devSeedVotes = () => call<Record<string, unknown>>("dev_seed_votes");
export const devRunCloseDay = () => call<Record<string, unknown>>("dev_run_close_day");
export const devResetDay = () => call<Record<string, unknown>>("dev_reset_day");
export const devStatus = () => call<DevStatus>("dev_status");

// Phase 4 · Step 0 — retention levers (simulate a week of behaviour in minutes).
export const devAdvanceDay = (iSubmitted: boolean) =>
  call<Record<string, unknown>>("dev_advance_day", { p_i_submitted: iSubmitted });
export const devGrantXp = (amount = 100) =>
  call<Record<string, unknown>>("dev_grant_xp", { p_amount: amount });
export const devBreakStreak = () => call<Record<string, unknown>>("dev_break_streak");
export const devForceComeback = () => call<Record<string, unknown>>("dev_force_comeback");
export const devFillVoteCap = () => call<Record<string, unknown>>("dev_fill_vote_cap");
