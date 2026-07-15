/**
 * Profile — same layout own/others (spec §11c). Avatar+frame → username · title ·
 * level → stat strip (galleries · streak weeks · hearts · crowns) → wins wall
 * (hero). Own: starred row + sign out. Others: Follow. Follower/following counts
 * are never shown, to anyone (spec §9).
 */
import { Image } from 'expo-image';
import { ChevronLeft, CloudOff, Crown, MoreHorizontal, Settings, Star, Trophy } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ringForLevel, titleForLevel } from '@lib/cosmetics';
import type { ProfileData, ProfileWin } from '@lib/profile';
import { levelProgress } from '@lib/xp';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { colors, fonts, frame, icons, radius, space, typeScale } from '@/components/tokens';

type Props = {
  data: ProfileData | null;
  loading: boolean;
  onFollowToggle?: () => void;
  onSignOut?: () => void;
  onOpenWin?: (win: ProfileWin, username: string) => void;
  onBack?: () => void;
  onMore?: () => void;
  onSettings?: () => void;
  followBusy?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

export function ProfileView({ data, loading, onFollowToggle, onSignOut, onOpenWin, onBack, onMore, onSettings, followBusy, error, onRetry }: Props) {
  void onSignOut; // sign out now lives in the settings sheet (owned by the screen)
  const prog = levelProgress(data?.xp ?? 0);
  const ring = ringForLevel(prog.level);
  const title = titleForLevel(prog.level);
  const xpPct = prog.toNext > 0 ? Math.min(100, (prog.into / prog.toNext) * 100) : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {(onBack || onMore || onSettings) && (
        <View style={styles.backHeader}>
          {onBack ? <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={onBack} /> : <View />}
          {onMore && <IconButton icon={MoreHorizontal} accessibilityLabel="More" onPress={onMore} />}
          {onSettings && <IconButton icon={Settings} accessibilityLabel="Settings" onPress={onSettings} />}
        </View>
      )}
      {error && !data && (
        <View style={styles.errorWrap}>
          <EmptyState
            icon={CloudOff}
            line="Couldn't load this profile. Check your connection."
            ctaLabel="Retry"
            onCta={onRetry}
          />
        </View>
      )}
      {!(error && !data) && (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar
            username={data?.username ?? '·'}
            uri={data?.avatarUrl}
            size={72}
            ringColor={ring.color}
            ringWidth={ring.width}
          />
          <Text style={styles.username} numberOfLines={1}>
            {data?.username ?? ' '}
          </Text>
          <View style={styles.levelRow}>
            <Text style={styles.title}>{title}</Text>
            <Mono size={typeScale.caption} color={colors.paper60}>
              LV {prog.level}
            </Mono>
          </View>
          {data?.isSelf && !prog.atMax && (
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
          <Stat label="galleries" value={data?.galleries ?? 0} />
          <Stat label="streak wks" value={data?.streakWeeks ?? 0} />
          <Stat label="hearts" value={data?.hearts ?? 0} />
          <Stat label="crowns" value={data?.crowns ?? 0} icon={<Crown size={12} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />} />
        </View>

        {!data?.isSelf && onFollowToggle && (
          <Button
            label={data?.isFollowing ? 'Following' : 'Follow'}
            variant={data?.isFollowing ? 'ghost' : 'primary'}
            fullWidth
            loading={followBusy}
            onPress={onFollowToggle}
          />
        )}

        {data?.isSelf && data.starred.length > 0 && (
          <View style={styles.starredBlock}>
            <View style={styles.rowHead}>
              <Star size={13} strokeWidth={icons.strokeWidth} color={colors.paper60} fill={colors.paper60} />
              <Mono size={typeScale.caption} color={colors.paper60}>
                STARRED
              </Mono>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starredRow}>
              {data.starred.map((s) => (
                <View key={s.key} style={styles.starredTile}>
                  {s.uri ? (
                    <Image source={{ uri: s.uri }} style={styles.starredImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.starredImg, styles.skeleton]} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.winsHead}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            WINS WALL
          </Mono>
        </View>
        {loading ? (
          <View style={styles.winsGrid}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.winCell, styles.winSkel, styles.skeleton]} />
            ))}
          </View>
        ) : (data?.wins.length ?? 0) === 0 ? (
          <View style={styles.winsEmpty}>
            <Trophy size={28} strokeWidth={icons.strokeWidth} color={colors.paper40} />
            <Text style={styles.winsLine}>{data?.isSelf ? 'Your wins will live here' : 'No gallery wins yet'}</Text>
            <Text style={styles.winsSub}>
              {data?.isSelf
                ? 'Gallery photos earn a permanent spot on your wall.'
                : 'Gallery placements will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.winsGrid}>
            {data?.wins.map((w) => (
              <Pressable
                key={w.id}
                accessibilityRole="button"
                style={styles.winCell}
                onPress={() => onOpenWin?.(w, data.username)}
              >
                {/* No crown badge: the print carries its own status glyph, and at
                    3 columns a badge on top of it was just two crowns. */}
                <FramedPhoto
                  photoUri={w.uri}
                  dayNumber={w.dayNumber}
                  frameId={data.equippedFrame}
                  status={w.status}
                />
              </Pressable>
            ))}
          </View>
        )}

      </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValue}>
        {icon}
        <Mono weight="semibold" size={typeScale.title} color={colors.paper}>
          {value}
        </Mono>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  backHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  content: { padding: space.gutter, gap: space.gutter * 1.5 },
  identity: { alignItems: 'center', gap: 8, paddingTop: space.gutter },
  username: { fontFamily: fonts.sansSemiBold, fontSize: typeScale.title, color: colors.paper },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  xpWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  xpTrack: { width: 120, height: 4, borderRadius: 2, backgroundColor: colors.ink2, overflow: 'hidden' },
  xpFill: { height: 4, borderRadius: 2, backgroundColor: colors.safelight },
  statStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    paddingVertical: 18,
  },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  starredBlock: { gap: 10 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starredRow: { gap: 8, paddingRight: space.gutter },
  starredTile: { width: 72, height: 96 },
  starredImg: { width: 72, height: 90, backgroundColor: colors.ink2 },
  winsHead: { flexDirection: 'row' },
  winsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  winCell: { width: '32%' }, // FramedPhoto owns the 3:4 print aspect
  winSkel: { aspectRatio: frame.aspect }, // the loader has no print to size it
  skeleton: { backgroundColor: colors.ink2 },
  errorWrap: { flex: 1, justifyContent: 'center' },
  winsEmpty: { alignItems: 'center', gap: 10, paddingVertical: space.gutter * 2 },
  winsLine: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.paper },
  winsSub: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60, textAlign: 'center' },
});
