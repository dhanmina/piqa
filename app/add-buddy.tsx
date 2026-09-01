import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchProfile } from '../lib/profile';
import { searchProfiles, sendBuddyRequest, cancelBuddyRequest, type SearchResult } from '../lib/buddies';
import { Screen } from '../components/Screen';
import { FilledField } from '../components/FilledField';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { TextLink } from '../components/TextLink';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

function relationshipLabel(status: SearchResult['relationship']): string {
  switch (status) {
    case 'accepted':
      return 'Buddies';
    case 'pending_sent':
      return 'Requested';
    case 'pending_received':
      return 'Check requests';
    default:
      return 'Add';
  }
}

export default function AddBuddy() {
  const { u } = useLocalSearchParams<{ u?: string }>();
  const [ownUsername, setOwnUsername] = useState<string | null>(null);
  const [query, setQuery] = useState(u ?? '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile().then(({ data }) => setOwnUsername(data?.username ?? null));
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearchError(false);
      return;
    }
    setSearching(true);
    const { data, error } = await searchProfiles(q);
    setSearchError(!!error);
    if (!error) setResults(data);
    setSearching(false);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(handle);
  }, [query, runSearch]);

  async function handleAdd(result: SearchResult) {
    setSendingId(result.id);
    const { error } = await sendBuddyRequest(result.username);
    setSendingId(null);
    if (error) {
      Alert.alert('Could not send request', error.message);
      return;
    }
    runSearch(query);
  }

  async function handleCancel(result: SearchResult) {
    if (!result.requestId) return;
    setSendingId(result.id);
    const { error } = await cancelBuddyRequest(result.requestId);
    setSendingId(null);
    if (error) {
      Alert.alert('Could not cancel request', error.message);
      return;
    }
    setResults((prev) =>
      prev.map((r) => (r.id === result.id ? { ...r, relationship: 'none', requestId: null } : r))
    );
  }

  function handleShare() {
    if (!ownUsername) return;
    Share.share({ message: `Add me on piqa: piqa://add-buddy?u=${ownUsername}` });
  }

  return (
    <Screen style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Add a buddy</Text>
        <Pressable
          hitSlop={touchTarget.min}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            width: touchTarget.min,
            height: touchTarget.min,
            borderRadius: radius.button,
            backgroundColor: colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...type.title, color: colors.textPrimary }}>✕</Text>
        </Pressable>
      </View>

      {ownUsername && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...type.caption, color: colors.textMuted }}>Your username: {ownUsername}</Text>
          <TextLink label="Share invite link" inline onPress={handleShare} />
        </View>
      )}

      <FilledField placeholder="Search by username" value={query} onChangeText={setQuery} autoComplete="off" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {searching ? null : searchError ? (
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Couldn't search. Check your connection and try again.
          </Text>
        ) : query.trim().length >= 2 && results.length === 0 ? (
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>No one found.</Text>
        ) : (
          results.map((r) => (
            <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar url={r.avatarUrl} name={r.displayName ?? r.username} size={40} />
              <Text style={{ ...type.body, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                {r.displayName ?? r.username}
              </Text>
              <TextLink
                label={
                  sendingId === r.id
                    ? r.relationship === 'pending_sent'
                      ? 'Cancelling...'
                      : 'Sending...'
                    : r.relationship === 'pending_sent'
                      ? 'Cancel'
                      : relationshipLabel(r.relationship)
                }
                disabled={
                  sendingId === r.id ||
                  (r.relationship !== 'none' && r.relationship !== 'pending_sent')
                }
                accessibilityLabel={
                  r.relationship === 'pending_sent'
                    ? `Cancel request to ${r.displayName ?? r.username}`
                    : `${relationshipLabel(r.relationship)} ${r.displayName ?? r.username}`
                }
                onPress={() => (r.relationship === 'pending_sent' ? handleCancel(r) : handleAdd(r))}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
