import { invalidate } from "../cache";
import { supabase } from "./supabase";

export type StudioFace = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type Studio = {
  id: string;
  name: string;
  inviteCode: string;
  isDirector: boolean;
  memberCount: number;
  membersPreview: StudioFace[];
  standingMade: number;
  standingOf: number;
  streakDays: number;
};

export type StudioMember = StudioFace & {
  role: "director" | "member";
  submittedToday: boolean;
};

export const STUDIO_KEY = "studio:mine";
export const STUDIO_MEMBERS_KEY = "studio:members";

type RawStudio = {
  found: boolean;
  id: string;
  name: string;
  invite_code: string;
  is_director: boolean;
  member_count: number;
  members_preview: { id: string; username: string; avatar_url: string | null }[];
  standing_made: number;
  standing_of: number;
  streak_days: number;
};

type RawMember = {
  id: string;
  username: string;
  avatar_url: string | null;
  role: "director" | "member";
  submitted_today: boolean;
};

export async function fetchStudio(): Promise<Studio | null> {
  const { data, error } = await supabase.rpc("get_studio");
  if (error) throw error;
  const res = data as RawStudio;
  if (!res?.found) return null;
  return {
    id: res.id,
    name: res.name,
    inviteCode: res.invite_code,
    isDirector: res.is_director,
    memberCount: res.member_count,
    membersPreview: res.members_preview.map((m) => ({
      id: m.id,
      username: m.username,
      avatarUrl: m.avatar_url,
    })),
    standingMade: res.standing_made,
    standingOf: res.standing_of,
    streakDays: res.streak_days,
  };
}

export async function fetchStudioMembers(): Promise<StudioMember[]> {
  const { data, error } = await supabase.rpc("get_studio_members");
  if (error) throw error;
  const res = data as { found: boolean; members: RawMember[] };
  if (!res?.found) return [];
  return res.members.map((m) => ({
    id: m.id,
    username: m.username,
    avatarUrl: m.avatar_url,
    role: m.role,
    submittedToday: m.submitted_today,
  }));
}

type Mutation = { ok: boolean; reason?: string; studio_id?: string };

async function afterMutation() {
  invalidate(STUDIO_KEY);
  invalidate(STUDIO_MEMBERS_KEY);
}

export async function createStudio(name: string): Promise<Mutation> {
  const { data, error } = await supabase.rpc("create_studio", { p_name: name });
  if (error) throw error;
  if ((data as Mutation)?.ok) await afterMutation();
  return data as Mutation;
}

export async function joinStudioByCode(code: string): Promise<Mutation> {
  const { data, error } = await supabase.rpc("join_studio_by_code", { p_code: code });
  if (error) throw error;
  if ((data as Mutation)?.ok) await afterMutation();
  return data as Mutation;
}

export async function renameStudio(name: string): Promise<Mutation> {
  const { data, error } = await supabase.rpc("rename_studio", { p_name: name });
  if (error) throw error;
  if ((data as Mutation)?.ok) await afterMutation();
  return data as Mutation;
}

export async function removeStudioMember(userId: string): Promise<Mutation> {
  const { data, error } = await supabase.rpc("remove_studio_member", { p_user: userId });
  if (error) throw error;
  if ((data as Mutation)?.ok) await afterMutation();
  return data as Mutation;
}

export async function leaveStudio(): Promise<Mutation> {
  const { data, error } = await supabase.rpc("leave_studio");
  if (error) throw error;
  if ((data as Mutation)?.ok) await afterMutation();
  return data as Mutation;
}

export async function deleteStudio(): Promise<Mutation> {
  const { data, error } = await supabase.rpc("delete_studio");
  if (error) throw error;
  if ((data as Mutation)?.ok) await afterMutation();
  return data as Mutation;
}
