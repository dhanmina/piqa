/**
 * Another user's profile (spec §11c — same layout as own). Follow / unfollow;
 * counts stay hidden. ⋯ → block (mutual invisibility, spec §9).
 *
 * The route param can be a UUID or a username (from share links like
 * joinpiqa.com/u/username). Usernames are resolved to UUIDs via RPC before
 * loading the profile.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';

import { blockUser } from '@lib/services/moderation';
import { follow, unfollow } from '@lib/services/profile';
import { useProfile } from '@lib/hooks/useProfile';
import { supabase } from '@lib/services/supabase';
import { ProfileView } from '@/components/ProfileView';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, typeScale } from '@/components/tokens';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_username' as never, {
    p_username: username,
  } as never);
  if (error) return null;
  return (data as string | null) ?? null;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // Resolve username → UUID if the param isn't already a UUID.
  useEffect(() => {
    if (!id) return;
    if (UUID_RE.test(id)) {
      setResolvedId(id);
      return;
    }
    setResolving(true);
    void resolveUsername(id).then((uuid) => {
      setResolvedId(uuid);
      setResolving(false);
    });
  }, [id]);

  const { data, loading, error, refresh } = useProfile(resolvedId);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const onFollowToggle = async () => {
    if (!data) return;
    setBusy(true);
    if (data.isFollowing) await unfollow(data.id);
    else await follow(data.id);
    await refresh();
    setBusy(false);
  };

  const onBlock = async () => {
    if (!data) return;
    setShowMenu(false);
    await blockUser(data.id);
    router.back(); // they vanish from my surfaces, and I from theirs
  };

  const notFound = !resolving && !!id && !UUID_RE.test(id) && resolvedId === null;

  return (
    <>
      <ProfileView
        data={data}
        loading={loading || resolving}
        error={!!error || notFound}
        onRetry={() => void refresh()}
        onBack={() => router.back()}
        onMore={data && !data.isSelf ? () => setShowMenu(true) : undefined}
        onFollowToggle={() => void onFollowToggle()}
        followBusy={busy}
      />
      <Sheet visible={showMenu} onClose={() => setShowMenu(false)} title={data ? `@${data.username}` : undefined}>
        <Pressable accessibilityRole="button" style={styles.row} onPress={() => void onBlock()}>
          <Text style={styles.block}>Block this shooter</Text>
        </Pressable>
        <Text style={styles.note}>Blocking hides each of you from the other, everywhere.</Text>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12 },
  block: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.heart },
  note: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
});
