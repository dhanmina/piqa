import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { colors, fonts, iconStroke, icons, space, typeScale } from '@/components/tokens';

type EmptyStateProps = {
  icon: LucideIcon;
  /** Name the action, never the absence: "Your journal starts with one shot". */
  line: string;
  /** Optional longer explanation rendered smaller/dimmer beneath `line`. */
  sub?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function EmptyState({ icon: Icon, line, sub, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon size={icons.emptyStateSize} strokeWidth={iconStroke(icons.emptyStateSize)} color={colors.paper60} />
      <Text style={styles.line}>{line}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
      {ctaLabel && <Button label={ctaLabel} variant="ghost" onPress={onCta} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: space.gutter * 2,
    paddingHorizontal: space.gutter,
  },
  line: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
    textAlign: 'center',
  },
});
