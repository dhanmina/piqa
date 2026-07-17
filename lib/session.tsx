import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { getRememberMe } from "./authPrefs";
import { clearPersistedCache, hydrateCache } from "./cache";
import { supabase } from "./supabase";

type SessionState = {
  session: Session | null;
  /** true until the persisted session has been read from AsyncStorage. */
  loading: boolean;
};

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let mounted = true;
    // Live auth changes only take over AFTER the init below has settled the first
    // paint and applied the remember-me opt-out. supabase emits startup events on
    // launch — INITIAL_SESSION, plus a TOKEN_REFRESHED from autoRefreshToken — and
    // letting those through would flip a NON-remembered session to "signed in",
    // racing (and sometimes beating) the opt-out sign-out below. That race was the
    // "remember me not working" bug: the refreshed session won and stayed logged in.
    let initDone = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!initDone) return;
      setState({ session, loading: false });
      // Session owns only the cache lifecycle; the navigator triggers prefetch
      // (it layers above session, so importing prefetch here would cycle).
      // Sign-out wipes the prior account's cache so the next one starts clean.
      if (event === "SIGNED_OUT") void clearPersistedCache();
    });

    // Read the persisted session AND rehydrate the RPC cache before we drop the
    // splash, so the first screen paints from disk instead of a skeleton.
    void Promise.all([supabase.auth.getSession(), hydrateCache()]).then(async ([{ data }]) => {
      let session = data.session;
      // "Remember me" opt-out: a session the user didn't ask to keep must not
      // survive a cold launch. supabase already persisted it, so clear it here —
      // locally (no network revoke that could hang the splash offline) — along
      // with its cached data, before it's ever treated as signed in.
      if (session && !(await getRememberMe())) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        await clearPersistedCache();
        session = null;
      }
      initDone = true;
      if (!mounted) return;
      setState({ session, loading: false });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
