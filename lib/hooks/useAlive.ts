import { useEffect, useRef, type DependencyList } from "react";

/**
 * A safer useEffect for async work that sets state. The callback receives
 * `isAlive()` — call it before any setState to avoid updating unmounted
 * components.
 *
 * Replaces the manual `let alive = true; return () => { alive = false }` pattern
 * that was duplicated 23+ times across the codebase.
 *
 * @example
 * useAliveEffect((isAlive) => {
 *   void fetchUser(id).then((user) => {
 *     if (isAlive()) setUser(user);
 *   });
 * }, [id]);
 */
export function useAliveEffect(fn: (isAlive: () => boolean) => void | (() => void), deps: DependencyList) {
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const cleanup = fn(() => aliveRef.current);

    return () => {
      aliveRef.current = false;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
