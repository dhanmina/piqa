/**
 * /admin-content — the daily editorial panel (admin-only). Replaces the daily
 * hand-run SQL for the three things the editor touches every cycle: the technique
 * hint, the Golden Shot flag, and (after reveal) the "why this won" PotD note.
 * Every action hits an is_admin-guarded RPC, so the server is the real gate.
 */
import { useRouter } from 'expo-router';
import { Alert, ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, Camera } from 'lucide-react-native';

import { setGolden, setHint, setPotdNote } from '@lib/services/admin';
import { useAdminToday } from '@lib/hooks/useAdmin';
import { S } from '@lib/utils/admin-strings';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
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

export default function AdminContentScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAdminToday();
  const drop = data?.drop ?? null;

  const [hint, setHintText] = useState('');
  const [note, setNoteText] = useState('');
  const [savingHint, setSavingHint] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [togglingGold, setTogglingGold] = useState(false);
  const [toast, setToast] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setHintText(drop?.hint ?? '');
    setNoteText(drop?.potd?.note ?? '');
  }, [drop?.id, drop?.hint, drop?.potd?.note]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onToggleGold = async () => {
    if (!drop) return;
    setTogglingGold(true);
    try {
      await setGolden(drop.id, !drop.is_golden);
      await refresh();
      setToast(drop.is_golden ? 'Golden removed' : 'Golden Shot set');
    } catch (e) {
      Alert.alert(S.contentError, String((e as Error).message));
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
      setToast(S.contentSaved);
    } catch (e) {
      Alert.alert(S.contentError, String((e as Error).message));
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
      setToast(S.contentSaved);
    } catch (e) {
      Alert.alert(S.contentError, String((e as Error).message));
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={S.contentTitle} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />}
      >
        <Button label={S.contentLibraryCta} variant="ghost" onPress={() => router.push('/admin-library')} fullWidth />

        {loading && !drop ? (
          <ActivityIndicator color={colors.paper60} style={{ marginTop: 40 }} />
        ) : error ? (
          <EmptyState
            icon={AlertCircle}
            line={error === 'not_authorized' ? S.notAuthorized : error}
          />
        ) : !drop ? (
          <EmptyState
            icon={Camera}
            line={S.hubTodayEmpty.replace('{region}', data?.region ?? 'your region')}
          />
        ) : (
          <>
            <Card title={`${S.contentToday} · ${data?.region ?? ''} · ${drop.status.toUpperCase()}`}>
              <View style={styles.rowPad}>
                <Text style={styles.subject}>{drop.subject_text}</Text>
                <View style={styles.metaRow}>
                  {drop.status === 'live' ? (
                    <>
                      <Mono size={typeScale.caption} color={colors.paper60}>{S.contentClosesIn} </Mono>
                      <Countdown until={drop.submit_closes_at} size={typeScale.caption} />
                    </>
                  ) : (
                    <Mono size={typeScale.caption} color={colors.paper60}>{drop.drop_date}</Mono>
                  )}
                </View>
              </View>
            </Card>

            <Card title={S.contentGoldenShot}>
              <View style={styles.rowPad}>
                <Text style={styles.help}>
                  {drop.is_golden ? S.contentGoldenActive : S.contentGoldenInactive}
                </Text>
                <Button
                  label={drop.is_golden ? S.contentGoldenRemove : S.contentGoldenMake}
                  variant={drop.is_golden ? 'ghost' : 'primary'}
                  onPress={onToggleGold}
                  loading={togglingGold}
                  fullWidth
                />
              </View>
            </Card>

            <Card title={S.contentHintTitle}>
              <View style={styles.rowPad}>
                <Text style={styles.help}>{S.contentHintHelp}</Text>
                <TextInput
                  style={styles.input}
                  value={hint}
                  onChangeText={setHintText}
                  placeholder={S.contentHintPlaceholder}
                  placeholderTextColor={colors.paper40}
                  multiline
                  accessibilityLabel={S.contentHintTitle}
                />
                <Button
                  label={S.contentHintSave}
                  onPress={onSaveHint}
                  loading={savingHint}
                  disabled={hint === (drop.hint ?? '')}
                  fullWidth
                />
              </View>
            </Card>

            <Card title={S.contentNoteTitle}>
              <View style={styles.rowPad}>
                {drop.potd ? (
                  <>
                    <Text style={styles.help}>
                      {S.contentNoteHelp.replace('{shooter}', drop.potd.shooter)}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={note}
                      onChangeText={setNoteText}
                      placeholder={S.contentNotePlaceholder}
                      placeholderTextColor={colors.paper40}
                      multiline
                      accessibilityLabel={S.contentNoteTitle}
                    />
                    <Button
                      label={S.contentNoteSave}
                      onPress={onSaveNote}
                      loading={savingNote}
                      disabled={note === (drop.potd.note ?? '')}
                      fullWidth
                    />
                  </>
                ) : (
                  <Text style={styles.muted}>
                    {drop.revealed ? S.contentNoteNoPotd : S.contentNoteLocked}
                  </Text>
                )}
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <Toast message={toast} visible={toast !== ''} onHide={() => setToast('')} />
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
});
