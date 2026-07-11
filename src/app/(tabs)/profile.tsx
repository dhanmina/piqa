/**
 * Profile (Phase 2 subset) — never blank. Real level/streak/stat strip exists
 * from signup; the wins wall shows an anticipation placeholder until the first
 * gallery win. Cosmetics, follow, showcase land in Phase 4.
 */
import { useFocusEffect } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@lib/supabase';
import { levelFromXp } from '@lib/xp';
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

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: streak }, { count: galleries }, { data: mySubs }] = await Promise.all([
          supabase.from('profiles').select('username, avatar_url, xp').eq('id', uid).single(),
          supabase.from('streaks').select('current_weeks').eq('user_id', uid).single(),
          supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('in_gallery', true),
          supabase.from('submissions').select('vote_count, reaction_count').eq('user_id', uid),
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
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const level = profile ? levelFromXp(profile.xp) : 1;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar username={profile?.username ?? '·'} uri={profile?.avatar_url} size={72} />
          <Text style={styles.username}>{profile?.username ?? ' '}</Text>
          <View style={styles.levelRow}>
            <Text style={styles.title}>Shutterbug</Text>
            <Mono size={typeScale.caption} color={colors.paper60}>
              LV {level}
            </Mono>
          </View>
        </View>

        <View style={styles.statStrip}>
          <Stat label="galleries" value={profile?.galleries ?? 0} />
          <Stat label="streak wks" value={profile?.streakWeeks ?? 0} />
          <Stat label="hearts" value={profile?.hearts ?? 0} />
        </View>

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
