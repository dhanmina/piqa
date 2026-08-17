import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { displayFamily } from '@/components/fonts';
import { colors, fonts, iconStroke, typeScale } from '@/components/tokens';

type PermissionBlockProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
};

const ICON_SIZE = 32;

/**
 * The reason-before-dialog message for a permission screen: a small safelight icon
 * (not hero sized) over a tight headline + subhead group. The headline and subhead
 * sit together with no dead space between them — the breathing room belongs between
 * this block and the CTA, and that gap is owned by the OnboardingScreen shell.
 */
export function PermissionBlock({ icon: Icon, title, subtitle }: PermissionBlockProps) {
  return (
    <View style={styles.wrap}>
      <Icon size={ICON_SIZE} strokeWidth={iconStroke(ICON_SIZE)} color={colors.safelight} />
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 16, // icon to headline group
  },
  textGroup: {
    alignItems: 'center',
    gap: 6, // tight: headline to subhead, one unit
  },
  title: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    lineHeight: typeScale.sub * 1.4,
    color: colors.paper60,
    textAlign: 'center',
  },
});
