import * as Network from "expo-network";

// Same taxonomy the capture queue uses to keep connectivity failures silent.
const NETWORK_RE =
  /network|fetch|timeout|timed out|connection|socket|unreachable|abort|offline|ENOTFOUND|ECONN/i;

/** Heuristic: does this error message look like a connectivity failure? */
export function isNetworkErrorMessage(message: string): boolean {
  return NETWORK_RE.test(message);
}

/**
 * Best-effort: is the device currently without a usable connection? Used to turn
 * "the server couldn't be reached" into a calm offline STATE instead of an error
 * — never the other way around, so an unknown result is treated as online.
 */
export async function isOffline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected === false || s.isInternetReachable === false;
  } catch {
    return false; // unknown → assume online; never invent an offline state
  }
}
