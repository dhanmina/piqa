import { useCallback, useEffect, useState } from "react";

import { supabase } from "./supabase";

// All calls hit is_admin-guarded SECURITY DEFINER RPCs — the server refuses a
// non-admin even if the screen were reached, so gating in the UI is convenience,
// not security. Casts are `as never` until `supabase gen types` re-runs.

/** Whether the signed-in user is an admin (drives the Settings entry + route). */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("is_admin" as never).then(({ data }) => {
      if (alive) setAdmin(data === true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return admin;
}

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

/** The current drop for the admin's region + the fields they edit each day. */
export function useAdminToday() {
  const [data, setData] = useState<AdminToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: res, error: err } = await supabase.rpc("admin_today" as never, {} as never);
    if (err) setError(err.message);
    else {
      setData(res as unknown as AdminToday);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

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

// ---- Subject library (the editorial calendar) --------------------------------

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

/** The full Subject library, ordered as the drop queue (unused by seq first). */
export function useSubjects() {
  const [data, setData] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: res, error: err } = await supabase.rpc("admin_list_prompts" as never);
    if (err) setError(err.message);
    else {
      setData((res as unknown as Subject[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

function assertOk(data: unknown) {
  const res = data as { ok?: boolean; reason?: string } | null;
  if (res && res.ok === false) throw new Error(res.reason ?? "failed");
}

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
