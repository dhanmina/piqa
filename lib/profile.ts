/**
 * Barrel re-export — hooks in lib/hooks/useProfile.ts, services in
 * lib/services/profile.ts. This file keeps old @lib/profile imports working.
 */
export {
  bestFinishLabel,
  deleteAccount,
  exportMyData,
  fetchFollowing,
  fetchProfile,
  follow,
  profileKey,
  unfollow,
  updateAvatar,
  updateUsername,
  type FollowedUser,
  type MyStats,
  type ProfileData,
  type ProfileWin,
} from "./services/profile";
export { useFollowingPreview, useMyStats, useProfile } from "./hooks/useProfile";
