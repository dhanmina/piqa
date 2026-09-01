import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/captureQueries';
import {
  fetchBuddies,
  fetchPendingRequests,
  fetchBuddyPeek,
  reactToCapture,
  respondToBuddyRequest,
  removeBuddy,
  type Buddy,
  type BuddyPeek,
  type PendingRequest,
} from '../../lib/buddies';
import { BuddyRow } from '../../components/BuddyRow';
import { BuddyPeekCard } from '../../components/BuddyPeekCard';
import { PendingRequestRow } from '../../components/PendingRequestRow';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { Button } from '../../components/Button';
import { Divider } from '../../components/Divider';
import { Screen } from '../../components/Screen';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar';
import { colors, spacing, type } from '../../lib/theme';

// Local date, not toISOString() -- same reason today.tsx's own copy of this exists:
// toISOString() converts to UTC, which lands the day boundary at UTC midnight
// instead of the device's local midnight.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadBuddiesOrThrow(): Promise<Buddy[]> {
  const { data, error } = await fetchBuddies();
  if (error) throw error;
  return data;
}

async function loadPendingRequestsOrThrow(): Promise<PendingRequest[]> {
  const { data, error } = await fetchPendingRequests();
  if (error) throw error;
  return data;
}

export default function BuddiesScreen() {
  const queryClient = useQueryClient();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [peekViewerOpen, setPeekViewerOpen] = useState(false);
  const todayISO = toISODate(new Date());

  // The persisted query cache (see app/_layout.tsx) means a returning visit to this tab
  // paints last-known buddies/requests immediately -- isLoading is only true the very
  // first time this has ever been fetched, not on every re-focus like the old
  // useState+useFocusEffect version (which blanked the screen back to "loading" on
  // every single visit, cache or not).
  const buddiesQuery = useQuery({ queryKey: queryKeys.buddies, queryFn: loadBuddiesOrThrow });
  const requestsQuery = useQuery({ queryKey: queryKeys.pendingRequests, queryFn: loadPendingRequestsOrThrow });
  const peekQuery = useQuery({
    queryKey: queryKeys.buddyPeek(todayISO),
    queryFn: async () => {
      const { data, error } = await fetchBuddyPeek(todayISO);
      if (error) throw error;
      return data;
    },
  });
  const buddies = buddiesQuery.data ?? [];
  const buddiesLoading = buddiesQuery.isLoading;
  const buddiesError = buddiesQuery.isError;
  const requests = requestsQuery.data ?? [];
  const requestsLoading = requestsQuery.isLoading;
  const requestsError = requestsQuery.isError;
  const peek = peekQuery.data ?? null;

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.buddies });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingRequests });
      queryClient.invalidateQueries({ queryKey: queryKeys.buddyPeek(todayISO) });
    }, [queryClient, todayISO])
  );

  async function handleReactToPeek() {
    if (!peek) return;
    queryClient.setQueryData(queryKeys.buddyPeek(todayISO), (prev: BuddyPeek | null | undefined) =>
      prev ? { ...prev, reactedByMe: true } : prev
    );
    const { error } = await reactToCapture(peek.buddyCaptureId);
    if (error) queryClient.invalidateQueries({ queryKey: queryKeys.buddyPeek(todayISO) });
  }

  async function handleReact(captureId: string) {
    queryClient.setQueryData(queryKeys.buddies, (prev: Buddy[] | undefined) =>
      prev?.map((b) => (b.todayCaptureId === captureId ? { ...b, reactedByMe: true } : b))
    );
    const { error } = await reactToCapture(captureId);
    if (error) queryClient.invalidateQueries({ queryKey: queryKeys.buddies });
  }

  async function handleRemove(buddy: Buddy) {
    const displayName = buddy.displayName ?? buddy.username;
    Alert.alert(`Remove ${displayName}?`, 'You can send a new request later if you change your mind.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          queryClient.setQueryData(queryKeys.buddies, (prev: Buddy[] | undefined) =>
            prev?.filter((b) => b.id !== buddy.id)
          );
          const { error } = await removeBuddy(buddy.id);
          if (error) {
            Alert.alert('Could not remove buddy', error.message);
            queryClient.invalidateQueries({ queryKey: queryKeys.buddies });
          }
        },
      },
    ]);
  }

  async function handleRespond(request: PendingRequest, accept: boolean) {
    setRespondingId(request.requestId);
    const { error } = await respondToBuddyRequest(request.requestId, accept);
    setRespondingId(null);
    if (error) {
      Alert.alert(accept ? 'Could not accept' : 'Could not decline', error.message);
      return;
    }
    queryClient.setQueryData(queryKeys.pendingRequests, (prev: PendingRequest[] | undefined) =>
      prev?.filter((r) => r.requestId !== request.requestId)
    );
    if (accept) queryClient.invalidateQueries({ queryKey: queryKeys.buddies });
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE }}
      >
        <Text style={{ ...type.screenTitle, color: colors.textPrimary }}>Buddies</Text>

        <Button label="Add a buddy" variant="secondary" onPress={() => router.push('/add-buddy')} />

        {!requestsLoading && requestsError && (
          <Text style={{ ...type.caption, color: colors.textMuted }}>
            Couldn't load your requests. Check your connection and try again.
          </Text>
        )}

        {!requestsLoading && !requestsError && requests.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ ...type.body, color: colors.textMuted }}>Requests</Text>
            {requests.map((r) => (
              <PendingRequestRow
                key={r.requestId}
                request={r}
                busy={respondingId === r.requestId}
                onAccept={() => handleRespond(r, true)}
                onDecline={() => handleRespond(r, false)}
              />
            ))}
          </View>
        )}

        {peek && <BuddyPeekCard peek={peek} onPress={() => setPeekViewerOpen(true)} onReact={handleReactToPeek} />}

        {(requests.length > 0 || peek) && buddies.length > 0 && <Divider />}

        {buddiesLoading ? null : buddiesError ? (
          <Text style={{ ...type.caption, color: colors.textMuted }}>
            Couldn't load your buddies. Check your connection and try again.
          </Text>
        ) : buddies.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {buddies.map((b) => (
              <BuddyRow key={b.id} buddy={b} onReact={handleReact} onRemove={() => handleRemove(b)} />
            ))}
          </View>
        ) : (
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Add a close friend to share your streak with. Totally optional.
          </Text>
        )}
      </ScrollView>

      {peek && (
        <PhotoViewerModal
          urls={[peek.myPhotoUrl, peek.buddyPhotoUrl]}
          cacheKeys={[peek.myCaptureId, peek.buddyCaptureId]}
          visible={peekViewerOpen}
          onClose={() => setPeekViewerOpen(false)}
        />
      )}
    </Screen>
  );
}
