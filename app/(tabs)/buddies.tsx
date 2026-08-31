import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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

export default function BuddiesScreen() {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [buddiesLoading, setBuddiesLoading] = useState(true);
  const [buddiesError, setBuddiesError] = useState(false);

  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadBuddies = useCallback(async () => {
    const { data, error } = await fetchBuddies();
    setBuddiesError(!!error);
    if (!error) setBuddies(data);
    setBuddiesLoading(false);
  }, []);

  const loadRequests = useCallback(async () => {
    const { data, error } = await fetchPendingRequests();
    setRequestsError(!!error);
    if (!error) setRequests(data);
    setRequestsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBuddies();
      loadRequests();
    }, [loadBuddies, loadRequests])
  );

  async function handleReact(captureId: string) {
    setBuddies((prev) => prev.map((b) => (b.todayCaptureId === captureId ? { ...b, reactedByMe: true } : b)));
    const { error } = await reactToCapture(captureId);
    if (error) loadBuddies();
  }

  async function handleRespond(request: PendingRequest, accept: boolean) {
    setRespondingId(request.requestId);
    const { error } = await respondToBuddyRequest(request.requestId, accept);
    setRespondingId(null);
    if (error) {
      Alert.alert(accept ? 'Could not accept' : 'Could not decline', error.message);
      return;
    }
    setRequests((prev) => prev.filter((r) => r.requestId !== request.requestId));
    if (accept) loadBuddies();
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
