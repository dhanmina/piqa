// app/shared-links.tsx
//
// Every share is a standing public link -- listing and revoking them here is
// what keeps "public link, no login" from being a one-way door. Matches the
// buddies.tsx / add-buddy.tsx list-with-inline-action pattern rather than
// introducing a new list treatment.
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { TextLink } from '../components/TextLink';
import { listRecapShares, revokeRecapShare, type RecapShare } from '../lib/recapShares';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

function kindLabel(kind: RecapShare['kind']): string {
  return kind === 'year' ? 'Year recap' : 'Week recap';
}

export default function SharedLinks() {
  const [shares, setShares] = useState<RecapShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await listRecapShares();
    setShares(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function handleRevoke(id: string) {
    setRevokingId(id);
    const { error } = await revokeRecapShare(id);
    setRevokingId(null);
    if (error) {
      Alert.alert('Could not revoke link', 'Try again in a moment.');
      return;
    }
    setShares((prev) => prev.map((s) => (s.id === id ? { ...s, revokedAt: new Date().toISOString() } : s)));
  }

  return (
    <Screen style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Shared links</Text>
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

      {!loading && shares.length === 0 ? (
        <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
          No shared links yet.
        </Text>
      ) : (
        <FlatList
          data={shares}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.body, color: colors.textPrimary }}>{kindLabel(item.kind)}</Text>
                <Text style={{ ...type.caption, color: colors.textMuted }}>
                  {item.revokedAt ? 'Revoked' : 'Active'}
                </Text>
              </View>
              {!item.revokedAt && (
                <TextLink
                  label={revokingId === item.id ? 'Revoking...' : 'Revoke'}
                  disabled={revokingId === item.id}
                  onPress={() => handleRevoke(item.id)}
                />
              )}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
