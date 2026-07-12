/**
 * Profile (Phase 2 subset) — never blank. Real level/streak/stat strip exists
 * from signup; the wins wall shows an anticipation placeholder until the first
 * gallery win. Cosmetics, follow, showcase land in Phase 4.
 */
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Star, Trophy } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signThumbs } from '@lib/cache';
import { frameForLevel, titleForLevel } from '@lib/cosmetics';
import { supabase } from '@lib/supabase';
import { levelProgress } from '@lib/xp';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { colors, fonts, space, typeScale } from '@/components/tokens';

type ProfileData = {
  username: string;
  avatar_url: string | null;
  xp: number;
  galleries: number;
  streakWeeks: number;
  hearts: number;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [starred, setStarred] = useState<{ key: string; uri: string | null }[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: streak }, { count: galleries }, { data: mySubs }, { data: starFree }, { data: starDaily }] =
          await Promise.all([
            supabase.from('profiles').select('username, avatar_url, xp').eq('id', uid).single(),
            supabase.from('streaks').select('current_weeks').eq('user_id', uid).single(),
            supabase
              .from('submissions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', uid)
              .eq('in_gallery', true),
            supabase.from('submissions').select('vote_count, reaction_count').eq('user_id', uid),
            supabase
              .from('free_shots')
              .select('id, thumb_path, starred_at')
              .eq('user_id', uid)
              .eq('starred', true)
              .order('starred_at', { ascending: false })
              .limit(12),
            supabase
              .from('submissions')
              .select('id, thumb_path, starred_at')
              .eq('user_id', uid)
              .eq('starred', true)
              .order('starred_at', { ascending: false })
              .limit(12),
          ]);

        if (!alive || !prof) return;
        const hearts = (mySubs ?? []).reduce((sum, s) => sum + s.vote_count + s.reaction_count, 0);
        setProfile({
          username: prof.username,
          avatar_url: prof.avatar_url,
          xp: prof.xp,
          galleries: galleries ?? 0,
          streakWeeks: streak?.current_weeks ?? 0,
          hearts,
        });

        // Starred shots pinned on the profile (spec §11c). Newest star first.
        const starRows = [...(starFree ?? []), ...(starDaily ?? [])]
          .sort((a, b) => Date.parse(b.starred_at ?? '') - Date.parse(a.starred_at ?? ''))
          .slice(0, 12);
        const signed = await signThumbs(starRows.map((r) => r.thumb_path).filter((p): p is string => !!p));
        if (alive) {
          setStarred(
            starRows.map((r) => ({ key: r.id, uri: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null })),
          );
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const prog = levelProgress(profile?.xp ?? 0);
  const frame = frameForLevel(prog.level);
  const title = titleForLevel(prog.level);
  const xpPct = prog.toNext > 0 ? Math.min(100, (prog.into / prog.toNext) * 100) : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar
            username={profile?.username ?? '·'}
            uri={profile?.avatar_url}
            size={72}
            frameColor={frame.color}
            frameWidth={frame.width}
          />
          <Text style={styles.username}>{profile?.username ?? ' '}</Text>
          <View style={styles.levelRow}>
            <Text style={styles.title}>{title}</Text>
            <Mono size={typeScale.caption} color={colors.paper60}>
              LV {prog.level}
            </Mono>
          </View>
          {/* Quiet-mode XP: shown here (and, later, the morning reveal) only. */}
          {!prog.atMax && (
            <View style={styles.xpWrap}>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
              </View>
              <Mono size={typeScale.caption} color={colors.paper60}>
                {prog.into} / {prog.toNext} XP
              </Mono>
            </View>
          )}
        </View>

        <View style={styles.statStrip}>
          <Stat label="galleries" value={profile?.galleries ?? 0} />
          <Stat label="streak wks" value={profile?.streakWeeks ?? 0} />
          <Stat label="hearts" value={profile?.hearts ?? 0} />
        </View>

        {starred.length > 0 && (
          <View style={styles.starredBlock}>
            <View style={styles.starredHead}>
              <Star size={13} strokeWidth={2} color={colors.paper60} fill={colors.paper60} />
              <Mono size={typeScale.caption} color={colors.paper60}>
                STARRED
              </Mono>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starredRow}>
              {starred.map((s) => (
                <View key={s.key} style={styles.starredTile}>
                  {s.uri ? (
                    <Image source={{ uri: s.uri }} style={styles.starredImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.starredImg, styles.starredSkeleton]} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.winsWall}>
          <Trophy size={28} strokeWidth={2} color={colors.paper40} />
          <Text style={styles.winsLine}>Your wins will live here</Text>
          <Text style={styles.winsSub}>Gallery photos earn a permanent spot on your wall.</Text>
        </View>

        <View style={styles.signOut}>
          <Button label="Sign out" variant="ghost" onPress={() => void supabase.auth.signOut()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Mono weight="semibold" size={typeScale.title} color={colors.paper}>
        {value}
      </Mono>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: space.gutter,
    gap: space.gutter * 1.5,
  },
  identity: {
    alignItems: 'center',
    gap: 8,
    paddingTop: space.gutter,
  },
  username: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.title,
    color: colors.paper,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
  },
  xpWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  xpTrack: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink2,
    overflow: 'hidden',
  },
  xpFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.safelight,
  },
  statStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.ink2,
    borderRadius: 12,
    paddingVertical: 18,
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  starredBlock: {
    gap: 10,
  },
  starredHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starredRow: {
    gap: 8,
    paddingRight: space.gutter,
  },
  starredTile: {
    width: 72,
    height: 96,
  },
  starredImg: {
    width: 72,
    height: 96,
    backgroundColor: colors.ink2,
  },
  starredSkeleton: {
    backgroundColor: colors.ink2,
  },
  winsWall: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: space.gutter * 2,
  },
  winsLine: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  winsSub: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
    textAlign: 'center',
  },
  signOut: {
    alignItems: 'center',
  },
});
