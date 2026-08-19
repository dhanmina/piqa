import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNetworkStateAsync } from "expo-network";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { identify, resetAnalytics } from "./services/analytics";
import { configurePurchases, logOutPurchases } from "./services/purchases";
import { getRememberMe } from "./utils/authPrefs";
import { clearPersistedCache, hydrateCache } from "./cache";
import { supabase } from "./services/supabase";

const AUTH_STORAGE_KEY = "supabase.auth.token";

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
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initDone) return;
      // When offline, Supabase may emit SIGNED_OUT because a token refresh
      // failed — but the session data is still valid in AsyncStorage. Suppress
      // that signal so we don't dump the user to the login screen.
      if (event === "SIGNED_OUT" && !session) {
        const net = await getNetworkStateAsync().catch(() => ({ isInternetReachable: false }));
        if (!net.isInternetReachable) return;
      }
      setState({ session, loading: false });
      // Tie analytics to the user — only on actual sign-in, not on silent
      // token refreshes which fire ~every 30min in the background.
      if (session && event === "SIGNED_IN") {
        identify(session.user.id);
        configurePurchases(session.user.id);
      }
      // Session owns only the cache lifecycle; the navigator triggers prefetch
      // (it layers above session, so importing prefetch here would cycle).
      // Sign-out wipes the prior account's cache so the next one starts clean.
      if (event === "SIGNED_OUT") {
        resetAnalytics();
        logOutPurchases();
        void clearPersistedCache();
      }
    });

    // Read the persisted session AND rehydrate the RPC cache before we drop the
    // splash, so the first screen paints from disk instead of a skeleton.
    void Promise.all([supabase.auth.getSession(), hydrateCache()]).then(async ([{ data }]) => {
      let session = data.session;

      // Offline fallback: Supabase clears the in-memory session when a token
      // refresh fails (no network), but the raw data is still in AsyncStorage.
      // Read it directly and restore so the user stays signed in offline.
      if (!session) {
        const net = await getNetworkStateAsync().catch(() => ({ isInternetReachable: false }));
        if (!net.isInternetReachable) {
          try {
            const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
            if (raw) {
              const stored = JSON.parse(raw);
              if (stored?.current_session?.access_token) {
                const { error } = await supabase.auth.setSession(stored.current_session);
                if (!error) session = stored.current_session as Session;
              }
            }
          } catch {
            // Corrupt or missing storage — treat as signed out.
          }
        }
      }

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
      if (session) {
        identify(session.user.id); // cold-launch signed-in
        configurePurchases(session.user.id);
      }
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
