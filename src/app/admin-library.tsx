/**
 * /admin-library — the Subject editorial calendar (admin-only). The library is a
 * queue: Subjects drop in seq order (unused first), so managing seq here IS the
 * scheduling. Add / edit / reorder / delete Subjects and their technique hints,
 * all through is_admin-guarded RPCs.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  SUBJECT_CATEGORIES,
  createSubject,
  deleteSubject,
  setHint,
  updateSubject,
  useSubjects,
  type Subject,
  type SubjectCategory,
} from '@lib/admin';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

function CategoryChips({
  value,
  onChange,
}: {
  value: SubjectCategory;
  onChange: (c: SubjectCategory) => void;
}) {
  return (
    <View style={styles.chips}>
      {SUBJECT_CATEGORIES.map((c) => {
        const on = c === value;
        return (
          <Pressable key={c} onPress={() => onChange(c)} style={[styles.chip, on && styles.chipOn]}>
            <Mono size={typeScale.caption} color={on ? colors.ink : colors.paper60}>
              {c}
            </Mono>
          </Pressable>
        );
      })}
    </View>
  );
}

function status(s: Subject): string {
  if (s.used_at) return 'DROPPED';
  if (s.in_use) return 'SCHEDULED';
  return 'QUEUED';
}

function SubjectRow({ s, onChanged }: { s: Subject; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(s.text);
  const [category, setCategory] = useState<SubjectCategory>(s.category);
  const [hint, setHintText] = useState(s.hint ?? '');
  const [seq, setSeq] = useState(s.seq == null ? '' : String(s.seq));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const seqNum = seq.trim() === '' ? null : Number.parseInt(seq, 10);
      await updateSubject(s.id, text.trim(), category, Number.isNaN(seqNum as number) ? null : seqNum, s.is_sponsored);
      if ((hint.trim() || null) !== (s.hint ?? null)) await setHint(s.id, hint);
      setOpen(false);
      onChanged();
    } catch (e) {
      Alert.alert('Could not save', String((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete Subject?', s.text, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSubject(s.id);
            onChanged();
          } catch (e) {
            Alert.alert(
              'Could not delete',
              (e as Error).message === 'in_use' ? 'This Subject is tied to a drop and keeps history.' : String((e as Error).message),
            );
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.subjectCard}>
      <Pressable style={styles.subjectHead} onPress={() => setOpen((o) => !o)}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.subjectText}>{s.text}</Text>
          <View style={styles.subMeta}>
            <Mono size={10} color={colors.paper60}>{s.category.toUpperCase()}</Mono>
            <Mono size={10} color={s.used_at ? colors.paper40 : colors.safelight}>· {status(s)}</Mono>
            {s.hint ? <Mono size={10} color={colors.paper40}>· hint</Mono> : null}
          </View>
        </View>
        <Mono size={typeScale.caption} color={colors.paper40}>{s.seq ?? '—'}</Mono>
      </Pressable>

      {open ? (
        <View style={styles.editBody}>
          <TextInput style={styles.input} value={text} onChangeText={setText} multiline placeholder="Subject" placeholderTextColor={colors.paper40} />
          <CategoryChips value={category} onChange={setCategory} />
          <TextInput style={styles.input} value={hint} onChangeText={setHintText} multiline placeholder="Technique hint (optional)" placeholderTextColor={colors.paper40} />
          <View style={styles.seqRow}>
            <Mono size={typeScale.caption} color={colors.paper60}>QUEUE #</Mono>
            <TextInput style={styles.seqInput} value={seq} onChangeText={setSeq} keyboardType="number-pad" placeholder="—" placeholderTextColor={colors.paper40} />
          </View>
          <View style={styles.editActions}>
            <Button label="Delete" variant="text" onPress={remove} />
            <Button label="Save" onPress={save} loading={saving} disabled={text.trim() === ''} />
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

  const add = async () => {
    setAdding(true);
    try {
      await createSubject(newText.trim(), newCat);
      setNewText('');
      refresh();
    } catch (e) {
      Alert.alert('Could not add', String((e as Error).message));
    } finally {
      setAdding(false);
    }
  };

  const queued = data.filter((s) => !s.used_at).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Admin · Subjects" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
            ADD SUBJECT
          </Mono>
          <View style={styles.card}>
            <View style={styles.addBody}>
              <TextInput
                style={styles.input}
                value={newText}
                onChangeText={setNewText}
                multiline
                placeholder="e.g. The oldest thing you own"
                placeholderTextColor={colors.paper40}
              />
              <CategoryChips value={newCat} onChange={setNewCat} />
              <Button label="Add to queue" onPress={add} loading={adding} disabled={newText.trim() === ''} fullWidth />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
            LIBRARY · {queued} QUEUED / {data.length} TOTAL
          </Mono>
          {loading && data.length === 0 ? (
            <ActivityIndicator color={colors.paper60} style={{ marginTop: 24 }} />
          ) : error ? (
            <Text style={styles.error}>{error === 'not_authorized' ? 'Not authorized.' : error}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {data.map((s) => (
                <SubjectRow key={s.id} s={s} onChanged={refresh} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.ink },
  chipOn: { backgroundColor: colors.paper },
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
