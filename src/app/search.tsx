import { useRouter } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchUsers, type SearchUser } from '@lib/search';
import { Avatar } from '@/components/atoms/Avatar';
import { displayFamily } from '@/components/fonts';
import { colors, fonts, icons, space, typeScale } from '@/components/tokens';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await searchUsers(term);
      setResults(data);
      setLoading(false);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const renderItem = ({ item }: { item: SearchUser }) => (
    <Pressable
      accessibilityRole="button"
      style={styles.userRow}
      onPress={() => router.push({ pathname: '/u/[id]', params: { id: item.id } })}
    >
      <Avatar username={item.username} uri={item.avatar_url} size={48} />
      <Text style={styles.username} numberOfLines={1}>
        {item.username}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <SearchIcon size={20} color={colors.paper60} strokeWidth={icons.strokeWidth} />
          <TextInput
            style={styles.input}
            placeholder="Search shooters..."
            placeholderTextColor={colors.paper30}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearBtn}>
              <X size={16} color={colors.paper60} strokeWidth={icons.strokeWidth} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {loading && results.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.paper60} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.trim().length >= 2 && !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No shooters found</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    paddingVertical: 12,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink2,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink2,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: typeScale.body,
    color: colors.paper,
    height: '100%',
  },
  clearBtn: { padding: 4 },
  cancelText: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  list: { padding: space.gutter, paddingBottom: 48 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  username: {
    flex: 1,
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: typeScale.body, color: colors.paper60 },
});
