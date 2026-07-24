import { supabase } from "./supabase";

// All calls hit is_admin-guarded SECURITY DEFINER RPCs — the server refuses a
// non-admin even if the screen were reached, so gating in the UI is convenience,
// not security. Casts are `as never` until `supabase gen types` re-runs.

function assertOk(data: unknown) {
  const res = data as { ok?: boolean; reason?: string } | null;
  if (res && res.ok === false) throw new Error(res.reason ?? "failed");
}

// ─── Content panel (daily editorial) ─────────────────────────────────────────

export type AdminPotd = {
  submission_id: string;
  note: string | null;
  thumb_path: string | null;
  shooter: string;
};

export type AdminDrop = {
  id: string;
  drop_date: string;
  status: string;
  drops_at: string;
  submit_closes_at: string;
  voting_closes_at: string;
  subject_id: string;
  subject_text: string;
  hint: string | null;
  is_golden: boolean;
  revealed: boolean;
  potd: AdminPotd | null;
};

export type AdminToday = { region: string; drop: AdminDrop | null };

export async function setGolden(dropId: string, golden: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_golden" as never, { p_drop: dropId, p_golden: golden } as never);
  if (error) throw new Error(error.message);
}

export async function setHint(subjectId: string, hint: string): Promise<void> {
  const { error } = await supabase.rpc("admin_set_subject_hint" as never, { p_subject: subjectId, p_hint: hint } as never);
  if (error) throw new Error(error.message);
}

export async function setPotdNote(submissionId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("admin_set_potd_note" as never, { p_submission: submissionId, p_note: note } as never);
  if (error) throw new Error(error.message);
}

// ─── Subject library (the editorial calendar) ────────────────────────────────

export const SUBJECT_CATEGORIES = ["object", "color", "light", "pov", "emotion", "absurd"] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

export type Subject = {
  id: string;
  text: string;
  category: SubjectCategory;
  hint: string | null;
  is_sponsored: boolean;
  seq: number | null;
  used_at: string | null;
  created_at: string;
  in_use: boolean;
};

export async function createSubject(text: string, category: SubjectCategory, seq: number | null = null): Promise<void> {
  const { data, error } = await supabase.rpc("admin_create_prompt" as never, {
    p_text: text,
    p_category: category,
    p_is_sponsored: false,
    p_seq: seq,
  } as never);
  if (error) throw new Error(error.message);
  assertOk(data);
}

export async function updateSubject(
  id: string,
  text: string,
  category: SubjectCategory,
  seq: number | null,
  isSponsored: boolean,
): Promise<void> {
  const { data, error } = await supabase.rpc("admin_update_prompt" as never, {
    p_id: id,
    p_text: text,
    p_category: category,
    p_is_sponsored: isSponsored,
    p_seq: seq,
  } as never);
  if (error) throw new Error(error.message);
  assertOk(data);
}

export async function deleteSubject(id: string): Promise<void> {
  const { data, error } = await supabase.rpc("admin_delete_prompt" as never, { p_id: id } as never);
  if (error) throw new Error(error.message);
  assertOk(data);
}

// ─── Members ─────────────────────────────────────────────────────────────────

export type Member = {
  id: string;
  username: string;
  region: string;
  is_premium: boolean;
  is_admin: boolean;
  xp: number;
  created_at: string;
  submissions: number;
  crowns: number;
  current_weeks: number;
  days_this_week: number;
};

export async function setPremium(userId: string, value: boolean): Promise<void> {
  const { data, error } = await supabase.rpc("admin_set_premium" as never, { p_user: userId, p_value: value } as never);
  if (error) throw new Error(error.message);
  assertOk(data);
}

export async function setAdmin(userId: string, value: boolean): Promise<void> {
  const { data, error } = await supabase.rpc("admin_set_user_admin" as never, { p_user: userId, p_value: value } as never);
  if (error) throw new Error(error.message);
  assertOk(data);
}

// ─── Waitlist ────────────────────────────────────────────────────────────────

export type WaitlistEntry = {
  email: string;
  created_at: string;
};

export async function deleteWaitlist(email: string): Promise<void> {
  const { data, error } = await supabase.rpc("admin_delete_waitlist" as never, { p_email: email } as never);
  if (error) throw new Error(error.message);
  assertOk(data);
}

// ─── Moderation (reports) ────────────────────────────────────────────────────

export type ReportEntry = {
  submission_id: string;
  thumb_path: string | null;
  image_path: string | null;
  shooter: string;
  shooter_id: string;
  drop_date: string;
  quarantined: boolean;
  in_gallery: boolean;
  reporters: number;
  reasons: Record<string, number>;
  latest: string;
  threshold: number;
};

// ─── Recent submissions ──────────────────────────────────────────────────────

export type RecentSubmission = {
  id: string;
  thumb_path: string | null;
  shooter: string;
  shooter_id: string;
  vote_count: number;
  reaction_count: number;
  drop_date: string;
  prompt: string;
  captured_at: string;
};

// ─── Audit feed ──────────────────────────────────────────────────────────────

export type AuditEntry = {
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  at: string;
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export type AnalyticsTotals = {
  users: number;
  submissions: number;
  votes: number;
  prompts: number;
  prompts_unused: number;
  pending_reports: number;
};

export type AnalyticsDaily = {
  date: string;
  submissions: number;
  votes: number;
};

export type AnalyticsCrown = {
  date: string;
  region: string;
  shooter: string | null;
  votes: number;
};

export type AnalyticsData = {
  totals: AnalyticsTotals;
  daily: AnalyticsDaily[];
  crowns: AnalyticsCrown[];
};

// ─── Engagement ──────────────────────────────────────────────────────────────

export type EngagementDaily = {
  date: string;
  submissions: number;
  voters: number;
  unique_submitters: number;
  unique_voters: number;
  participation_rate: number;
};

export type EngagementTotals = {
  total_premium: number;
  total_admins: number;
  active_streaks: number;
  avg_streak_weeks: number;
  max_streak_weeks: number;
  total_reactions: number;
};

export type EngagementData = {
  daily: EngagementDaily[];
  totals: EngagementTotals;
};

// ─── Frames ──────────────────────────────────────────────────────────────────

export type Frame = {
  id: string;
  label: string;
  ring_color: string | null;
  profile_svg: string | null;
  marker_svg: string | null;
  hairline_color: string | null;
  counter_color: string | null;
  suffix_text: string | null;
  suffix_color: string | null;
  unlock_kind: string;
  unlock_label: string | null;
  event_start: string | null;
  event_end: string | null;
  owners: number;
};
