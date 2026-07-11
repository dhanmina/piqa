import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { colors, fonts, icons, space, typeScale } from '@/components/tokens';

type EmptyStateProps = {
  icon: LucideIcon;
  /** Name the action, never the absence: "Your journal starts with one shot". */
  line: string;
  ctaLabel?: string;
  onCta?: () => void;
};

export function EmptyState({ icon: Icon, line, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon size={icons.emptyStateSize} strokeWidth={icons.strokeWidth} color={colors.paper60} />
      <Text style={styles.line}>{line}</Text>
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
});
