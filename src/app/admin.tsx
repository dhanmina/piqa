/**
 * /admin — the content editorial panel (admin-only). Replaces the daily hand-run
 * SQL for the three things the editor touches every cycle: the technique hint, the
 * Golden Shot flag, and (after reveal) the "why this won" PotD note. Every action
 * hits an is_admin-guarded RPC, so the server is the real gate; the Settings entry
 * only appears for admins as a convenience.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setGolden, setHint, setPotdNote, useAdminToday } from '@lib/admin';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { Mono } from '@/components/atoms/Mono';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
        {title}
      </Mono>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAdminToday();
  const drop = data?.drop ?? null;

  const [hint, setHintText] = useState('');
  const [note, setNoteText] = useState('');
  const [savingHint, setSavingHint] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [togglingGold, setTogglingGold] = useState(false);

  // Reflect the server values whenever a fresh drop arrives.
  useEffect(() => {
    setHintText(drop?.hint ?? '');
    setNoteText(drop?.potd?.note ?? '');
  }, [drop?.id, drop?.hint, drop?.potd?.note]);

  const onToggleGold = async () => {
    if (!drop) return;
    setTogglingGold(true);
    try {
      await setGolden(drop.id, !drop.is_golden);
      await refresh();
    } finally {
      setTogglingGold(false);
    }
  };

  const onSaveHint = async () => {
    if (!drop) return;
    setSavingHint(true);
    try {
      await setHint(drop.subject_id, hint);
      await refresh();
    } finally {
      setSavingHint(false);
    }
  };

  const onSaveNote = async () => {
    if (!drop?.potd) return;
    setSavingNote(true);
    try {
      await setPotdNote(drop.potd.submission_id, note);
      await refresh();
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Admin · Content" />

      <ScrollView contentContainerStyle={styles.content}>
        <Button label="Subject library →" variant="ghost" onPress={() => router.push('/admin-library')} fullWidth />

        {loading && !drop ? (
          <ActivityIndicator color={colors.paper60} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.error}>{error === 'not_authorized' ? 'Not authorized.' : error}</Text>
        ) : !drop ? (
          <Text style={styles.muted}>No drop scheduled for {data?.region ?? 'your region'} yet.</Text>
        ) : (
          <>
            <Card title={`TODAY · ${data?.region ?? ''} · ${drop.status.toUpperCase()}`}>
              <View style={styles.rowPad}>
                <Text style={styles.subject}>{drop.subject_text}</Text>
                <View style={styles.metaRow}>
                  {drop.status === 'live' ? (
                    <>
                      <Mono size={typeScale.caption} color={colors.paper60}>CLOSES IN </Mono>
                      <Countdown until={drop.submit_closes_at} size={typeScale.caption} />
                    </>
                  ) : (
                    <Mono size={typeScale.caption} color={colors.paper60}>{drop.drop_date}</Mono>
                  )}
                </View>
              </View>
            </Card>

            <Card title="GOLDEN SHOT">
              <View style={styles.rowPad}>
                <Text style={styles.help}>
                  {drop.is_golden
                    ? 'This drop is a Golden Shot — the Shot card shows gold brackets.'
                    : 'Mark this drop as the weekly Golden Shot.'}
                </Text>
                <Button
                  label={drop.is_golden ? 'Remove Golden' : 'Make it Golden'}
                  variant={drop.is_golden ? 'ghost' : 'primary'}
                  onPress={onToggleGold}
                  loading={togglingGold}
                  fullWidth
                />
              </View>
            </Card>

            <Card title="TECHNIQUE HINT">
              <View style={styles.rowPad}>
                <Text style={styles.help}>A one-line tip shown under the prompt on the live Shot.</Text>
                <TextInput
                  style={styles.input}
                  value={hint}
                  onChangeText={setHintText}
                  placeholder="e.g. Shoot toward the light; expose for the highlights."
                  placeholderTextColor={colors.paper40}
                  multiline
                />
                <Button
                  label="Save hint"
                  onPress={onSaveHint}
                  loading={savingHint}
                  disabled={hint === (drop.hint ?? '')}
                  fullWidth
                />
              </View>
            </Card>

            <Card title="WHY THIS WON">
              <View style={styles.rowPad}>
                {drop.potd ? (
                  <>
                    <Text style={styles.help}>
                      PotD by @{drop.potd.shooter}. A one-line note shown on the winning photo.
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={note}
                      onChangeText={setNoteText}
                      placeholder="e.g. The reflection turns a puddle into a second sky."
                      placeholderTextColor={colors.paper40}
                      multiline
                    />
                    <Button
                      label="Save note"
                      onPress={onSaveNote}
                      loading={savingNote}
                      disabled={note === (drop.potd.note ?? '')}
                      fullWidth
                    />
                  </>
                ) : (
                  <Text style={styles.muted}>
                    {drop.revealed ? 'No Photo of the Day for this drop.' : 'Available after the drop is revealed.'}
                  </Text>
                )}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 48, gap: 26 },
  section: { gap: 8 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: 4 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  rowPad: { padding: 16, gap: 14 },
  subject: { fontFamily: fonts.sansMedium, fontSize: typeScale.title, color: colors.paper, lineHeight: 26 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  help: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60, lineHeight: typeScale.caption * 1.4 },
  input: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper,
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: 12,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  muted: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center', marginTop: 24 },
  error: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.safelight, textAlign: 'center', marginTop: 24 },
});
