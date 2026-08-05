/**
 * /admin-library — the Subject editorial calendar (admin-only). The library is a
 * queue: Subjects drop in seq order (unused first), so managing seq here IS the
 * scheduling. Add / edit / reorder / delete Subjects and their technique hints,
 * all through is_admin-guarded RPCs.
 *
 * Improvements: search, status filters, toasts, pull-to-refresh, empty state,
 * Chip atom, full accessibility labels.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen } from 'lucide-react-native';

import {
  SUBJECT_CATEGORIES,
  createSubject,
  deleteSubject,
  setAngles,
  setHint,
  updateSubject,
  type Subject,
  type SubjectCategory,
} from '@lib/services/admin';
import { useSubjects } from '@lib/hooks/useAdmin';
import { S } from '@lib/utils/admin-strings';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

type StatusFilter = 'ALL' | 'QUEUED' | 'SCHEDULED' | 'DROPPED';

function status(s: Subject): 'QUEUED' | 'SCHEDULED' | 'DROPPED' {
  if (s.used_at) return 'DROPPED';
  if (s.in_use) return 'SCHEDULED';
  return 'QUEUED';
}

function SubjectRow({
  s,
  onChanged,
  onSaveToast,
}: {
  s: Subject;
  onChanged: () => void;
  onSaveToast: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(s.text);
  const [category, setCategory] = useState<SubjectCategory>(s.category);
  const [hint, setHintText] = useState(s.hint ?? '');
  const [angle1, setAngle1] = useState(s.angles?.[0] ?? '');
  const [angle2, setAngle2] = useState(s.angles?.[1] ?? '');
  const [angle3, setAngle3] = useState(s.angles?.[2] ?? '');
  const [seq, setSeq] = useState(s.seq == null ? '' : String(s.seq));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const seqNum = seq.trim() === '' ? null : Number.parseInt(seq, 10);
      await updateSubject(s.id, text.trim(), category, Number.isNaN(seqNum as number) ? null : seqNum, s.is_sponsored);
      if ((hint.trim() || null) !== (s.hint ?? null)) await setHint(s.id, hint);
      const nextAngles = [angle1, angle2, angle3].map((a) => a.trim()).filter((a) => a !== '');
      const prevAngles = s.angles ?? [];
      if (JSON.stringify(nextAngles) !== JSON.stringify(prevAngles)) await setAngles(s.id, nextAngles);
      setOpen(false);
      onSaveToast(S.libraryAdded);
      onChanged();
    } catch (e) {
      Alert.alert(S.libraryCouldNotSave, String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert(S.libraryDeleteConfirm, s.text, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: S.libraryDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSubject(s.id);
            onSaveToast(S.libraryDeleted);
            onChanged();
          } catch (e) {
            Alert.alert(
              S.libraryCouldNotDelete,
              (e as Error).message === 'in_use' ? S.libraryDeleteInUse : String((e as Error).message),
            );
          }
        },
      },
    ]);
  };

  const st = status(s);

  return (
    <View style={styles.subjectCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${S.librarySave} — ${s.text}`}
        accessibilityState={{ expanded: open }}
        style={styles.subjectHead}
        onPress={() => setOpen((o) => !o)}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.subjectText}>{s.text}</Text>
          <View style={styles.subMeta}>
            <Mono size={10} color={colors.paper60}>{s.category.toUpperCase()}</Mono>
            <Mono size={10} color={st === 'DROPPED' ? colors.paper40 : colors.safelight}>· {S[`libraryStatus${st}` as keyof typeof S]}</Mono>
            {s.hint ? <Mono size={10} color={colors.paper40}>· {S.libraryHintIndicator}</Mono> : null}
          </View>
        </View>
        <Mono size={typeScale.caption} color={colors.paper40}>{s.seq ?? '—'}</Mono>
      </Pressable>

      {open ? (
        <View style={styles.editBody}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Subject"
            placeholderTextColor={colors.paper40}
            accessibilityLabel="Subject text"
          />
          <View style={styles.chips}>
            {SUBJECT_CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={hint}
            onChangeText={setHintText}
            multiline
            placeholder={S.libraryHintPlaceholder}
            placeholderTextColor={colors.paper40}
            accessibilityLabel={S.libraryHintPlaceholder}
          />
          <TextInput
            style={styles.input}
            value={angle1}
            onChangeText={setAngle1}
            placeholder="Angle 1 (optional)"
            placeholderTextColor={colors.paper40}
            accessibilityLabel="Angle 1 (optional)"
          />
          <TextInput
            style={styles.input}
            value={angle2}
            onChangeText={setAngle2}
            placeholder="Angle 2 (optional)"
            placeholderTextColor={colors.paper40}
            accessibilityLabel="Angle 2 (optional)"
          />
          <TextInput
            style={styles.input}
            value={angle3}
            onChangeText={setAngle3}
            placeholder="Angle 3 (optional)"
            placeholderTextColor={colors.paper40}
            accessibilityLabel="Angle 3 (optional)"
          />
          <View style={styles.seqRow}>
            <Mono size={typeScale.caption} color={colors.paper60}>{S.libraryQueueLabel}</Mono>
            <TextInput
              style={styles.seqInput}
              value={seq}
              onChangeText={setSeq}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.paper40}
              accessibilityLabel={S.libraryQueueLabel}
            />
          </View>
          <View style={styles.editActions}>
            <Button label={S.libraryDelete} variant="text" onPress={remove} />
            <Button label={S.librarySave} onPress={save} loading={saving} disabled={text.trim() === ''} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminLibraryScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useSubjects();

  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState<SubjectCategory>('object');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [toast, setToast] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      await createSubject(newText.trim(), newCat);
      setNewText('');
      setToast(S.libraryAdded);
      refresh();
    } catch (e) {
      Alert.alert(S.libraryCouldNotAdd, String((e as Error).message));
    } finally {
      setAdding(false);
    }
  };

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.text.toLowerCase().includes(q) || s.category.includes(q));
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((s) => status(s) === statusFilter);
    }
    return list;
  }, [data, search, statusFilter]);

  const queued = (data ?? []).filter((s) => !s.used_at).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={S.libraryTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />}
      >
        {/* ── Add subject ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
            {S.libraryAddTitle}
          </Mono>
          <View style={styles.card}>
            <View style={styles.addBody}>
              <TextInput
                style={styles.input}
                value={newText}
                onChangeText={setNewText}
                multiline
                placeholder={S.libraryAddPlaceholder}
                placeholderTextColor={colors.paper40}
                accessibilityLabel={S.libraryAddPlaceholder}
              />
              <View style={styles.chips}>
                {SUBJECT_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} selected={c === newCat} onPress={() => setNewCat(c)} />
                ))}
              </View>
              <Button label={S.libraryAddCta} onPress={add} loading={adding} disabled={newText.trim() === ''} fullWidth />
            </View>
          </View>
        </View>

        {/* ── Library list ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
            {S.librarySection} · {queued} {S.libraryQueued} / {(data ?? []).length} {S.libraryTotal}
          </Mono>

          {/* Search bar */}
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={S.librarySearchPlaceholder}
            placeholderTextColor={colors.paper40}
            accessibilityLabel={S.librarySearchPlaceholder}
          />

          {/* Status filter chips */}
          <View style={styles.filterRow}>
            {(['ALL', 'QUEUED', 'SCHEDULED', 'DROPPED'] as StatusFilter[]).map((f) => (
              <Chip
                key={f}
                label={S[`libraryFilter${f}` as keyof typeof S]}
                selected={statusFilter === f}
                onPress={() => setStatusFilter(f)}
              />
            ))}
          </View>

          {loading && (data ?? []).length === 0 ? (
            <ActivityIndicator color={colors.paper60} style={{ marginTop: 24 }} />
          ) : error ? (
            <Text style={styles.error}>{error === 'not_authorized' ? S.notAuthorized : error}</Text>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              line={search || statusFilter !== 'ALL' ? 'No subjects match your filters.' : S.libraryEmpty}
            />
          ) : (
            <View style={{ gap: 8 }}>
              {filtered.map((s) => (
                <SubjectRow key={s.id} s={s} onChanged={refresh} onSaveToast={setToast} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      <Toast message={toast} visible={toast !== ''} onHide={() => setToast('')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 64, gap: 26 },
  section: { gap: 8 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: 4 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  addBody: { padding: 16, gap: 14 },
  input: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper,
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: 12,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  searchInput: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper,
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paper30,
    padding: 12,
    minHeight: 44,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subjectCard: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  subjectHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  subjectText: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  subMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  editBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  seqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seqInput: {
    fontFamily: fonts.mono,
    fontSize: typeScale.sub,
    color: colors.paper,
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    textAlign: 'center',
  },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.safelight, textAlign: 'center', marginTop: 24 },
});
