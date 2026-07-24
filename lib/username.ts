import { useEffect, useState } from "react";

import { supabase } from "./services/supabase";

export type UsernameStatus = "idle" | "short" | "checking" | "available" | "taken";

/**
 * Live username availability, shared by sign-up and the Edit-profile rename. Length
 * is judged locally (instant, matches the profiles 3-24 constraint); uniqueness is a
 * debounced RPC so the last keystroke wins and a stale response can't overwrite it.
 *
 * `idle` is the neutral state AND the fail-open state: empty input, the check
 * disabled, the name unchanged from `current`, or an RPC error all land here, so a
 * flaky network probe never blocks the form (account creation / the update is the
 * backstop).
 */
export function useUsernameStatus(raw: string, enabled: boolean, current?: string): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>("idle");

  useEffect(() => {
    if (!enabled) return setStatus("idle");
    const name = raw.trim();
    if (name.length === 0) return setStatus("idle");
    // Typing your own current name back is a no-op, not a "taken" collision.
    if (current && name.toLowerCase() === current.trim().toLowerCase()) return setStatus("idle");
    if (name.length < 3) return setStatus("short");

    setStatus("checking");
    let cancelled = false;
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", { p_username: name });
      if (cancelled) return;
      setStatus(error ? "idle" : data ? "available" : "taken");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [raw, enabled, current]);

  return status;
}

/** The line shown under the username field. null = show nothing (idle). */
export function usernameStatusMessage(status: UsernameStatus): { text: string; error: boolean } | null {
  switch (status) {
    case "short":
      return { text: "At least 3 characters.", error: true };
    case "checking":
      return { text: "Checking…", error: false };
    case "available":
      return { text: "That username is free.", error: false };
    case "taken":
      return { text: "That username is taken.", error: true };
    default:
      return null;
  }
}
