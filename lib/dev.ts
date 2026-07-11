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
};

async function call<T>(fn: "dev_force_drop" | "dev_seed_votes" | "dev_run_close_day" | "dev_reset_day" | "dev_status"): Promise<T> {
  const { data, error } = await supabase.rpc(fn);
  if (error) throw new Error(error.message);
  return data as unknown as T;
}

export const devForceDrop = () => call<Record<string, unknown>>("dev_force_drop");
export const devSeedVotes = () => call<Record<string, unknown>>("dev_seed_votes");
export const devRunCloseDay = () => call<Record<string, unknown>>("dev_run_close_day");
export const devResetDay = () => call<Record<string, unknown>>("dev_reset_day");
export const devStatus = () => call<DevStatus>("dev_status");
