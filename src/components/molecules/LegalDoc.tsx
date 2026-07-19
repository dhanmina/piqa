/**
 * LegalDoc — the one renderer for long-form policy text (Terms, Privacy). Both
 * screens are just structured content handed to this; the chrome (back header,
 * scroll padding, effective-date line, heading/paragraph rhythm) lives here once
 * so the two documents can never drift apart typographically.
 *
 * Content is data, not markup: a screen passes an ordered list of blocks so the
 * prose stays readable in the source and there's no per-screen StyleSheet.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mono } from '@/components/atoms/Mono';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { colors, fonts, space, typeScale } from '@/components/tokens';

/** One block of the document, in render order. */
export type LegalBlock =
  | { h: string } // section heading
  | { p: string } // paragraph
  | { li: string[] }; // bullet list

type LegalDocProps = {
  /** Header title and the document's own name. */
  title: string;
  /** Human-readable effective date, shown under the title (e.g. "19 July 2026"). */
  effectiveDate: string;
  /** Ordered content blocks. */
  blocks: LegalBlock[];
};

export function LegalDoc({ title, effectiveDate, blocks }: LegalDocProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={title} />

      <ScrollView contentContainerStyle={styles.content}>
        <Mono size={typeScale.caption} color={colors.paper60} style={styles.date}>
          Effective {effectiveDate}
        </Mono>

        {blocks.map((block, i) => {
          if ('h' in block) {
            return (
              <Text key={i} style={styles.h}>
                {block.h}
              </Text>
            );
          }
          if ('li' in block) {
            return (
              <View key={i} style={styles.list}>
                {block.li.map((item, j) => (
                  <View key={j} style={styles.liRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.p}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <Text key={i} style={styles.p}>
              {block.p}
            </Text>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 56, gap: 14 },
  date: { letterSpacing: 1, marginBottom: 4 },
  h: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.body,
    color: colors.paper,
    marginTop: 12,
  },
  p: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    lineHeight: 23,
    color: colors.paper60,
  },
  list: { gap: 8 },
  liRow: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  bullet: { fontFamily: fonts.sans, fontSize: typeScale.sub, lineHeight: 23, color: colors.paper40 },
});
