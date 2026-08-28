import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchProfile } from '../lib/profile';
import { searchProfiles, sendBuddyRequest, type SearchResult } from '../lib/buddies';
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
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile().then(({ data }) => setOwnUsername(data?.username ?? null));
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await searchProfiles(q);
    setResults(data);
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
    if (!error) {
      setResults((prev) => prev.map((r) => (r.id === result.id ? { ...r, relationship: 'pending_sent' } : r)));
    }
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
        {searching ? null : query.trim().length >= 2 && results.length === 0 ? (
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>No one found.</Text>
        ) : (
          results.map((r) => (
            <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar url={r.avatarUrl} name={r.displayName ?? r.username} size={40} />
              <Text style={{ ...type.body, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                {r.displayName ?? r.username}
              </Text>
              <TextLink
                label={sendingId === r.id ? 'Sending...' : relationshipLabel(r.relationship)}
                disabled={r.relationship !== 'none' || sendingId === r.id}
                accessibilityLabel={`${relationshipLabel(r.relationship)} ${r.displayName ?? r.username}`}
                onPress={() => handleAdd(r)}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
