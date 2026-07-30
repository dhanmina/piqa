import { useCached } from "./useCache";
import {
  fetchStudio,
  fetchStudioMembers,
  STUDIO_KEY,
  STUDIO_MEMBERS_KEY,
  type Studio,
  type StudioMember,
} from "../services/studios";

const STUDIO_TTL_MS = 60_000;

export function useStudio() {
  return useCached<Studio | null>(STUDIO_KEY, fetchStudio, STUDIO_TTL_MS);
}

export function useStudioMembers() {
  return useCached<StudioMember[]>(STUDIO_MEMBERS_KEY, fetchStudioMembers, STUDIO_TTL_MS);
}
