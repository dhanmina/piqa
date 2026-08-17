/**
 * /activity — the notification inbox, opened from the Today bell. The persisted,
 * personal half of the push pipeline (lib/activity.ts): the hearts, nods, wins,
 * crowns and follows your work earned, in one calm pulled surface. A pushed
 * screen (not a tab) so tapping through to a photo or profile returns HERE.
 *
 * Four kinds, four lines. Appreciation is rolled up per shot (never one row per
 * heart) so the feed reads calm. Opening the screen marks everything read, which
 * clears the bell dot on Today.
 */
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Bell, Crown, Image as ImageIcon, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markActivitySeen, useActivity, type ActivityItem } from '@lib/activity';
import { capture } from '@lib/services/analytics';
import { useSession } from '@lib/session';
import { PhotoDetailView } from '@/components/PhotoDetailView';
import { Avatar } from '@/components/atoms/Avatar';
import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { avatar, colors, fonts, iconStroke, radius, space, typeScale } from '@/components/tokens';

/** Compact age: "now", "3h", "2d", "5w". Numbers stay in Mono (camera readout). */
function timeAgo(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** The primary line for a row. Copy lives here, not in the DB, so it can change freely. */
function lineFor(item: ActivityItem): string {
  switch (item.kind) {
    case 'follow':
      return `${item.actor?.username ?? 'Someone'} started following you`;
    case 'potd':
      return 'Your shot was crowned Photo of the Day';
    case 'win':
      return 'Your shot made the gallery';
    case 'appreciation':
      return item.event_count === 1
        ? '1 curator appreciated your shot'
        : `${item.event_count} curators appreciated your shot`;
  }
}

const GLYPH: Record<Exclude<ActivityItem['kind'], 'follow' | 'appreciation'>, { icon: LucideIcon; color: string }> = {
  potd: { icon: Crown, color: colors.crown },
  win: { icon: ImageIcon, color: colors.safelight },
};

function Row({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* Leading: the follower's face, or a kind glyph in a matching circle. */}
      {item.kind === 'follow' ? (
        <Avatar username={item.actor?.username ?? '?'} uri={item.actor?.avatar_url} size={avatar.lg} />
      ) : item.kind === 'appreciation' ? (
        <View style={styles.glyph}>
          <HeartGlyph size={20} strokeWidth={iconStroke(20)} color={colors.heart} fill={colors.heart} />
        </View>
      ) : (
        <View style={styles.glyph}>
          {(() => {
            const g = GLYPH[item.kind];
            const Icon = g.icon;
            return <Icon size={20} strokeWidth={iconStroke(20)} color={g.color} />;
          })()}
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.line} numberOfLines={2}>
          {lineFor(item)}
        </Text>
        <View style={styles.metaRow}>
          {item.subject ? (
            <Text style={styles.subject} numberOfLines={1}>
              {item.subject}
            </Text>
          ) : null}
          <Mono size={typeScale.caption} color={colors.paper40}>
            {timeAgo(item.created_at)}
          </Mono>
        </View>
      </View>

      {/* Trailing: the print itself (4:5, zero radius — never round a photo). */}
      {item.thumb ? (
        <Image source={{ uri: item.thumb }} style={styles.thumb} contentFit="cover" transition={100} />
      ) : null}

      {!item.seen ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const { session } = useSession();
  // Every potd/win/appreciation row is about the viewer's OWN shot, so the shot
  // owner is always the signed-in user. Passing this makes PhotoDetailView's
  // isOwn true — no nod picker, no hearting your own photo.
  const myId = session?.user.id ?? null;
  const { items, refreshing, loadingMore, refresh, loadMore } = useActivity();
  // The shot opened in the in-place fullscreen viewer (potd/win/appreciation rows).
  const [viewer, setViewer] = useState<ActivityItem | null>(null);

  // Open = read. Clears the Today bell dot; measure opens for the retention funnel.
  useEffect(() => {
    void markActivitySeen();
    capture('activity_opened');
  }, []);

  const openItem = (item: ActivityItem) => {
    if (item.kind === 'follow') {
      // A new follower → their profile.
      if (item.actor) router.push({ pathname: '/u/[id]', params: { id: item.actor.id } });
      return;
    }
    // potd / win / appreciation → the exact shot that earned it, opened in place.
    if (item.submission_id) setViewer(item);
    else router.push('/(tabs)/gallery'); // fallback if the shot is somehow gone
  };

  // The shot's real standing (source of truth = the submission, not the row kind),
  // so a Top 10 shot never reads as Photo of the Day.
  const viewerStatus = viewer?.is_potd ? 'crown' : viewer?.in_gallery ? 'top10' : null;

  // One-item paging list for the viewer — the raw path is signed inside the view,
  // the already-signed thumb shows instantly underneath. Same shape as the gallery.
  const viewerPhotos = useMemo(
    () =>
      viewer?.submission_id
        ? [
            {
              id: viewer.submission_id,
              path: viewer.image_path ?? viewer.thumb_path ?? null,
              placeholderUri: viewer.thumb,
              userId: myId, // your own shot → isOwn true (no nod picker / self-heart)
              day: viewer.day_number ?? 0,
              status: viewer.is_potd ? 'crown' : viewer.in_gallery ? 'top10' : null,
            },
          ]
        : [],
    [viewer, myId],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Activity" />

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.paper60} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon={Bell} line="No activity yet." />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Row item={item} onPress={() => openItem(item)} />}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} color={colors.paper60} /> : null
          }
        />
      )}

      {/* In-place fullscreen for the shot that earned the row. Hearts/reactors/nods
          are uncontrolled here, so the view fetches them live from the submission. */}
      <Modal
        visible={viewer !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
        statusBarTranslucent
      >
        {viewer?.submission_id && (
          <PhotoDetailView
            lightbox
            hideShooter
            id={viewer.submission_id}
            path={viewer.image_path ?? viewer.thumb_path ?? ''}
            placeholderUri={viewer.thumb}
            userId={myId}
            day={viewer.day_number ?? 0}
            status={viewerStatus}
            theme={viewer.subject ?? undefined}
            photos={viewerPhotos}
            initialIndex={0}
            onClose={() => setViewer(null)}
            onOpenProfile={(uid) => {
              setViewer(null);
              router.push({ pathname: '/u/[id]', params: { id: uid } });
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  list: { paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowPressed: { opacity: 0.6 },
  glyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  line: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flexShrink: 1, fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  thumb: { width: 40, height: 50, borderRadius: radius.photo, backgroundColor: colors.ink2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.safelight },
  footer: { paddingVertical: 16 },
});
