/**
 * Darkroom Kit demo — every atom and molecule in every state.
 * Dev-only screen: it intentionally violates the one-accent-per-screen law
 * so all states can be inspected side by side. Real screens never do this.
 */
import * as Font from 'expo-font';
import { BookImage } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { Countdown } from '@/components/atoms/Countdown';
import { Field } from '@/components/atoms/Field';
import { HeartButton } from '@/components/atoms/HeartButton';
import { Mono } from '@/components/atoms/Mono';
import { StreakFlame } from '@/components/atoms/StreakFlame';
import { Toggle } from '@/components/atoms/Toggle';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { EmptyState } from '@/components/molecules/EmptyState';
import { GalleryGrid } from '@/components/molecules/GalleryGrid';
import { MatchupPair } from '@/components/molecules/MatchupPair';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { Sheet } from '@/components/molecules/Sheet';
import { ShotCard } from '@/components/molecules/ShotCard';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, typeScale } from '@/components/tokens';

const midnight = new Date(new Date().setHours(24, 0, 0, 0));
const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

// Demo cosmetic frame tone. Crown gold #E3B341 is PotD-only (spec §11b) and
// must never appear as a frame/cosmetic option.
const BRONZE = '#A67B4F';

const swatches = [
  ['ink', colors.ink],
  ['ink2', colors.ink2],
  ['paper', colors.paper],
  ['paper60', colors.paper60],
  ['safelight', colors.safelight],
  ['crown', colors.crown],
  ['heart', colors.heart],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Caption({ children }: { children: string }) {
  return <Text style={styles.caption}>{children}</Text>;
}

export default function DarkroomKit() {
  const [chipOn, setChipOn] = useState(true);
  const [liked, setLiked] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [bracketKey, setBracketKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pairIndex, setPairIndex] = useState(3);
  const [fieldValue, setFieldValue] = useState('');
  const [toggleOn, setToggleOn] = useState(true);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Darkroom Kit</Text>
        <Caption>dev-only — real screens use ONE safelight element</Caption>
        <Mono size={typeScale.caption} color={Font.isLoaded(fonts.display) ? colors.paper60 : colors.safelight}>
          {`Clash loaded: ${Font.isLoaded(fonts.display)}`}
          {!Font.isLoaded(fonts.display) && ' — display text is falling back to Instrument Sans (see TODO.md)'}
        </Mono>

        <Section title="Colors">
          <View style={styles.swatchRow}>
            {swatches.map(([name, value]) => (
              <View key={name} style={styles.swatchItem}>
                <View style={[styles.swatch, { backgroundColor: value }]} />
                <Mono size={10} color={colors.paper60}>
                  {name}
                </Mono>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Type — 34 / 24 / 17 / 15 / 13">
          <Text style={[styles.typeSample, { fontFamily: displayFamily, fontSize: typeScale.display }]}>
            Golden hour
          </Text>
          <Text style={[styles.typeSample, { fontFamily: displayFamily, fontSize: typeScale.title }]}>
            Something red within reach
          </Text>
          <Text style={[styles.typeSample, { fontFamily: fonts.sans, fontSize: typeScale.body }]}>
            Body — Instrument Sans, paper never #FFF
          </Text>
          <Text style={[styles.typeSample, { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 }]}>
            Secondary — paper60
          </Text>
          <Mono size={typeScale.caption}>ALL NUMBERS 1234567890 — IBM Plex Mono</Mono>
        </Section>

        <Section title="Button — primary / ghost / text">
          <View style={styles.row}>
            <Button label="Shoot it" onPress={() => setToast('Pressed primary')} />
            <Button label="Disabled" disabled />
          </View>
          <View style={styles.row}>
            <Button
              label="Tap for loading"
              loading={loadingDemo}
              onPress={() => {
                setLoadingDemo(true);
                setTimeout(() => setLoadingDemo(false), 2500);
              }}
            />
          </View>
          <View style={styles.row}>
            <Button label="Ghost" variant="ghost" />
            <Button label="Ghost disabled" variant="ghost" disabled />
          </View>
          <View style={styles.row}>
            <Button label="Text button" variant="text" />
            <Button label="Text disabled" variant="text" disabled />
          </View>
          <Caption>press = scale 0.97 + light haptic — no ripples</Caption>
        </Section>

        <Section title="Chip — selected inverts paper/ink">
          <View style={styles.row}>
            <Chip label="All" selected={chipOn} onPress={() => setChipOn(!chipOn)} />
            <Chip label="Daily Shots" selected={!chipOn} onPress={() => setChipOn(!chipOn)} />
            <Chip label="Disabled" disabled />
          </View>
        </Section>

        <Section title="Mono / Countdown — ticking numbers ARE the motion">
          <Countdown until={midnight} />
          <Caption>counting down to midnight (submit close)</Caption>
        </Section>

        <Section title="StreakFlame — no guilt state">
          <StreakFlame weeks={6} daysThisWeek={4} alive />
          <Caption>alive — goal met (4th dot is the goal)</Caption>
          <StreakFlame weeks={0} daysThisWeek={0} alive={false} />
          <Caption>lapsed — just an unfilled flame, never broken</Caption>
        </Section>

        <Section title="HeartButton — custom asymmetric heart">
          <View style={styles.row}>
            <HeartButton liked={liked} count={liked ? 24 : 23} onToggle={() => setLiked(!liked)} />
            <HeartButton liked count={112} />
            <HeartButton liked={false} count={0} disabled />
          </View>
          <Caption>outline → fill, 1.1 spring + haptic, no +1 floats</Caption>
        </Section>

        <Section title="Field — ink2 surface, no colored borders">
          <Field
            label="Username"
            value={fieldValue}
            onChangeText={setFieldValue}
            placeholder="how curators will never see you"
          />
          <Field label="Disabled" value="locked" editable={false} />
        </Section>

        <Section title="Toggle — square check well">
          <Toggle label="Submit as Today’s Shot" value={toggleOn} onChange={setToggleOn} />
          <Toggle label="Disabled" value={false} onChange={() => {}} disabled />
        </Section>

        <Section title="Avatar — ink2 fallback, frame = ring">
          <View style={styles.row}>
            <Avatar username="liwanag" />
            <Avatar username="kodachrome" frameColor={colors.safelight} />
            <Avatar username="goldenhour" size={56} frameColor={BRONZE} />
          </View>
          <Caption>frame tones: safelight, bronze — crown gold is PotD-only, never a frame</Caption>
        </Section>

        <Section title="Brackets — the viewfinder motif">
          <View style={styles.row}>
            <Brackets key={`b-${bracketKey}`} animated>
              <View style={styles.bracketDemo} />
            </Brackets>
            <Brackets color={colors.crown}>
              <View style={styles.bracketDemo} />
            </Brackets>
          </View>
          <Button label="Replay snap (200ms)" variant="ghost" onPress={() => setBracketKey((k) => k + 1)} />
          <Caption>gold ONLY on PotD — never on voting pairs</Caption>
        </Section>

        <Section title="PhotoTile — 0 radius, skeleton has no shimmer">
          <View style={styles.row}>
            <PhotoTile uri={img('piqa1')} hearts={31} style={styles.tile} />
            <PhotoTile style={styles.tile} />
          </View>
          <View style={styles.row}>
            <PhotoTile uri={img('piqa2')} hearts={87} badge="crown" style={styles.tile} />
            <PhotoTile uri={img('piqa3')} badge="daily" style={styles.tile} />
            <PhotoTile badge="queued" style={styles.tile} />
          </View>
          <Caption>default · skeleton · crown · daily · queued ↻ (offline) — heart counts sit below the print, never on it</Caption>
        </Section>

        <Section title="ShotCard — deliberately the loudest composition">
          <ShotCard prompt="Something red within reach" closesAt={midnight} onShoot={() => setToast('Camera opens in Phase 2')} />
          <Caption>live</Caption>
          <ShotCard prompt="Something red within reach" closesAt={midnight} offline />
          <Caption>offline — saved locally, never an error</Caption>
          <ShotCard prompt="Something red within reach" closesAt={midnight} submitted />
          <Caption>submitted — in the running ✓</Caption>
        </Section>

        <Section title="MatchupPair — blind, frameless, disciplined">
          <View style={styles.matchupBox}>
            <MatchupPair
              topUri={img('piqa-top' + pairIndex)}
              bottomUri={img('piqa-bottom' + pairIndex)}
              index={pairIndex}
              total={10}
              onPick={() => setPairIndex((i) => (i >= 10 ? 1 : i + 1))}
              onSkip={() => setPairIndex((i) => (i >= 10 ? 1 : i + 1))}
            />
          </View>
          <Caption>tap a photo to pick — paper flash + haptic</Caption>
        </Section>

        <Section title="GalleryGrid — PotD cover + 2-col grid">
          <GalleryGrid
            key={`g-${revealKey}`}
            reveal={revealKey > 0}
            photos={[
              { id: 'p0', uri: img('potd'), hearts: 143, isPotd: true, shooter: 'liwanag' },
              { id: 'p1', uri: img('g1'), hearts: 88 },
              { id: 'p2', uri: img('g2'), hearts: 76 },
              { id: 'p3', uri: img('g3'), hearts: 64 },
              { id: 'p4', uri: img('g4'), hearts: 51 },
            ]}
          />
          <Button label="Replay morning reveal" variant="ghost" onPress={() => setRevealKey((k) => k + 1)} />
        </Section>

        <Section title="Sheet & Toast">
          <View style={styles.row}>
            <Button label="Open sheet" variant="ghost" onPress={() => setSheetOpen(true)} />
            <Button label="Show toast" variant="ghost" onPress={() => setToast('Shot saved ✓ — uploading')} />
          </View>
        </Section>

        <Section title="EmptyState — name the action, never the absence">
          <EmptyState
            icon={BookImage}
            line="Your journal starts with one shot"
            ctaLabel="Open the camera"
            onCta={() => setToast('Camera opens in Phase 2')}
          />
        </Section>
      </ScrollView>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="A secondary flow">
        <Text style={styles.sheetBody}>
          All secondary flows live in sheets like this one — never separate screens.
        </Text>
        <Button label="Done" variant="ghost" onPress={() => setSheetOpen(false)} />
      </Sheet>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: 20,
    gap: 28,
    paddingBottom: 80,
  },
  h1: {
    fontFamily: displayFamily,
    fontSize: typeScale.display,
    color: colors.paper,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.sub,
    color: colors.safelight,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatchItem: {
    alignItems: 'center',
    gap: 4,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paper30,
  },
  typeSample: {
    color: colors.paper,
  },
  bracketDemo: {
    width: 96,
    height: 96,
    backgroundColor: colors.ink2,
  },
  tile: {
    width: 104,
  },
  matchupBox: {
    height: 420,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sheetBody: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
  },
});
