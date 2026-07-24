import { useCallback, useEffect, useState } from 'react';

import { getPhotoNods, nodLabel, nodsFor, submitNod, topNod, type NodCounts, type NodTag } from './nods';
import { useSession } from './session';
import { supabase } from './services/supabase';

type Reactor = { id: string; username: string; avatar_url: string | null };

/**
 * Encapsulates the heart, reactor, nod, and potd-note state for a single photo
 * in PhotoDetailView. Extracted from the 967-line view to keep the component as
 * pure layout + gesture logic — this hook owns the six Supabase calls and the
 * derived display values.
 *
 * In controlled mode (the gallery's `onToggleHeart` is present), the heart
 * count/liked come from the parent — this hook only fetches the reactor list.
 * In uncontrolled mode (the `/photo/[id]` route), it manages the full heart
 * lifecycle internally.
 */
export function usePhotoDetail(activeId: string | undefined, opts: {
  heartControlled: boolean;
  baseHearts: number;
  heartCount?: number;
  hearted?: boolean;
  onToggleHeart?: () => void;
  activeStatus?: string | null;
  activeNods?: NodCounts | null;
  activeCategory?: string | null;
  isOwn: boolean;
}) {
  const { heartControlled, baseHearts, heartCount, hearted, onToggleHeart, activeStatus, activeNods, isOwn } = opts;
  const { session } = useSession();
  const myId = session?.user.id;

  const [liked, setLiked] = useState(false);
  const [delta, setDelta] = useState(0);
  const [liveBase, setLiveBase] = useState<number | null>(null);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [showReactors, setShowReactors] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // --- Nods ---
  const [myNod, setMyNod] = useState<NodTag | null>(null);
  const [fetchedNods, setFetchedNods] = useState<NodCounts | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- resetting local state on photo change */
  useEffect(() => {
    setMyNod(null);
    if (!activeId || activeNods) {
      setFetchedNods(null);
      return;
    }
    let alive = true;
    void getPhotoNods(activeId).then((n) => {
      if (alive) setFetchedNods(n);
    });
    return () => { alive = false; };
  }, [activeId, activeNods]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayNods: NodCounts = { ...(activeNods ?? fetchedNods ?? {}) };
  if (myNod) displayNods[myNod] = (displayNods[myNod] ?? 0) + 1;
  const topTag = topNod(displayNods);

  // --- PotD note ---
  const [potdNote, setPotdNote] = useState<string | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- resetting on photo/status change */
  useEffect(() => {
    if (activeStatus !== 'crown' || !activeId) {
      setPotdNote(null);
      return;
    }
    let alive = true;
    void supabase
      .from('submissions')
      .select('potd_note')
      .eq('id', activeId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setPotdNote((data as { potd_note?: string | null } | null)?.potd_note ?? null);
      });
    return () => { alive = false; };
  }, [activeStatus, activeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // --- Reactors (signed only — votes stay anonymous, spec §8) ---
  const loadReactors = useCallback(async () => {
    if (!activeId) return;
    const { data: rx } = await supabase.from('reactions').select('user_id').eq('submission_id', activeId);
    const ids = (rx ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setReactors([]);
      return;
    }
    const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
    setReactors(profs ?? []);
  }, [activeId]);

  // --- Heart state ---
  /* eslint-disable react-hooks/set-state-in-effect -- loadReactors sets state via async callback */
  useEffect(() => {
    if (!activeId) return;
    if (heartControlled) {
      void loadReactors();
      return;
    }
    let alive = true;
    void (async () => {
      const [{ data: sub }, { data: mine }] = await Promise.all([
        supabase.from('submissions').select('reaction_count').eq('id', activeId).maybeSingle(),
        myId
          ? supabase.from('reactions').select('user_id').eq('user_id', myId).eq('submission_id', activeId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      if (sub) setLiveBase(sub.reaction_count);
      setLiked(!!mine);
      void loadReactors();
    })();
    return () => { alive = false; };
  }, [myId, activeId, loadReactors, heartControlled]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = async () => {
    if (!myId || !activeId) return;
    const next = !liked;
    setLiked(next);
    setDelta((d) => d + (next ? 1 : -1));
    if (next) {
      const { error } = await supabase.from('reactions').insert({ user_id: myId, submission_id: activeId, emoji: 'heart' });
      if (error) {
        setLiked(false);
        setDelta((d) => d - 1);
      }
    } else {
      const { error } = await supabase.from('reactions').delete().eq('user_id', myId).eq('submission_id', activeId);
      if (error) {
        setLiked(true);
        setDelta((d) => d + 1);
      }
    }
    void loadReactors();
  };

  const baseHeartsValue = liveBase ?? baseHearts;
  const displayLiked = heartControlled ? !!hearted : liked;
  const displayCount = heartControlled ? heartCount ?? 0 : Math.max(baseHeartsValue + delta, 0);
  const doToggle = heartControlled ? onToggleHeart! : () => void toggle();

  return {
    // Heart
    displayLiked,
    displayCount,
    doToggle,
    // Reactors
    reactors,
    showReactors,
    setShowReactors,
    loadReactors,
    // Nods
    topTag,
    displayNods,
    myNod,
    setMyNod,
    isOwn,
    // PotD note
    potdNote,
    // Toast
    toast,
    setToast,
    // Session
    myId,
  };
}

export type { NodTag, NodCounts };
export { nodsFor, nodLabel, submitNod };
