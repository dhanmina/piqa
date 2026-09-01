import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/captureQueries';
import {
  fetchBuddies,
  fetchPendingRequests,
  reactToCapture,
  respondToBuddyRequest,
  type Buddy,
  type PendingRequest,
} from '../../lib/buddies';
import { BuddyRow } from '../../components/BuddyRow';
import { PendingRequestRow } from '../../components/PendingRequestRow';
import { Button } from '../../components/Button';
import { Divider } from '../../components/Divider';
import { Screen } from '../../components/Screen';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar';
import { colors, spacing, type } from '../../lib/theme';

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

  // The persisted query cache (see app/_layout.tsx) means a returning visit to this tab
  // paints last-known buddies/requests immediately -- isLoading is only true the very
  // first time this has ever been fetched, not on every re-focus like the old
  // useState+useFocusEffect version (which blanked the screen back to "loading" on
  // every single visit, cache or not).
  const buddiesQuery = useQuery({ queryKey: queryKeys.buddies, queryFn: loadBuddiesOrThrow });
  const requestsQuery = useQuery({ queryKey: queryKeys.pendingRequests, queryFn: loadPendingRequestsOrThrow });
  const buddies = buddiesQuery.data ?? [];
  const buddiesLoading = buddiesQuery.isLoading;
  const buddiesError = buddiesQuery.isError;
  const requests = requestsQuery.data ?? [];
  const requestsLoading = requestsQuery.isLoading;
  const requestsError = requestsQuery.isError;

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.buddies });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingRequests });
    }, [queryClient])
  );

  async function handleReact(captureId: string) {
    queryClient.setQueryData(queryKeys.buddies, (prev: Buddy[] | undefined) =>
      prev?.map((b) => (b.todayCaptureId === captureId ? { ...b, reactedByMe: true } : b))
    );
    const { error } = await reactToCapture(captureId);
    if (error) queryClient.invalidateQueries({ queryKey: queryKeys.buddies });
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

        {requests.length > 0 && buddies.length > 0 && <Divider />}

        {buddiesLoading ? null : buddiesError ? (
          <Text style={{ ...type.caption, color: colors.textMuted }}>
            Couldn't load your buddies. Check your connection and try again.
          </Text>
        ) : buddies.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {buddies.map((b) => (
              <BuddyRow key={b.id} buddy={b} onReact={handleReact} />
            ))}
          </View>
        ) : (
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Add a close friend to share your streak with. Totally optional.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
