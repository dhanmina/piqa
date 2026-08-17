/**
 * /help — "How piqa works." A short, on-brand explainer of the fairness firewall
 * (blind curation, no follower counts) and the streak rule, so the mechanics that
 * make piqa different aren't things a user has to discover by accident.
 */
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { colors, fonts, space, typeScale } from '@/components/tokens';

type Block = { h: string } | { p: string };

const BLOCKS: Block[] = [
  {
    p: 'piqa is a daily photo game, judged blind, against the whole world. Not just your friends.',
  },

  { h: 'One Shot, one day' },
  {
    p: 'Once a day, everyone in your region gets the same Shot at a random time. You shoot it in-app, no gallery uploads, no filters, no AI images. What you see is what was shot today.',
  },

  { h: 'Blind curation' },
  {
    p: 'When it’s time to vote, you see two photos, head-to-head. No names, no follower counts, no likes. Just two photos and a pick. The photo wins on the photo alone, ranked by how often it’s picked (Bradley-Terry), never by who took it or how popular they are.',
  },

  { h: 'Why there are no follower counts' },
  {
    p: 'Follower counts turn curation into a popularity contest. piqa hides them everywhere: in the vote, in the gallery, on profiles. A new account and a year-old account get judged exactly the same way.',
  },

  { h: 'Your streak' },
  {
    p: 'Your streak tracks a rolling weekly goal. Submit on 4 of the last 7 days to keep it alive. Miss a day and it doesn’t reset. Only falling below that 4-of-7 window does. Streaks are built to forgive, not to punish.',
  },
];

export default function HelpScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="How piqa works" />

      <ScrollView contentContainerStyle={styles.content}>
        {BLOCKS.map((block, i) =>
          'h' in block ? (
            <Text key={i} style={styles.h}>
              {block.h}
            </Text>
          ) : (
            <Text key={i} style={styles.p}>
              {block.p}
            </Text>
          ),
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 56, gap: space.smPlus },
  h: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.body,
    color: colors.paper,
    marginTop: 12,
  },
  p: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    lineHeight: 23,
    color: colors.paper60,
  },
});
