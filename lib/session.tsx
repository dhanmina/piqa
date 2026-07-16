import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

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
    // Read the persisted session AND rehydrate the RPC cache before we drop the
    // splash, so the first screen paints from disk instead of a skeleton.
    void Promise.all([supabase.auth.getSession(), hydrateCache()]).then(([{ data }]) => {
      if (!mounted) return;
      setState({ session: data.session, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      // Session owns only the cache lifecycle; the navigator triggers prefetch
      // (it layers above session, so importing prefetch here would cycle).
      // Sign-out wipes the prior account's cache so the next one starts clean.
      if (event === "SIGNED_OUT") void clearPersistedCache();
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
