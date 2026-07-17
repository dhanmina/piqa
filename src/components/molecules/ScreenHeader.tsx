import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/atoms/IconButton';
import { displayFamily } from '@/components/fonts';
import { colors, space, typeScale } from '@/components/tokens';

type ScreenHeaderProps = {
  /** Show a back chevron on the left. Omit for a header with no back affordance. */
  onBack?: () => void;
  /** Left-aligned screen title, next to the back button. */
  title?: string;
  /** Right-aligned trailing control(s), e.g. a gear or a more button. */
  right?: ReactNode;
  /** Custom middle content (e.g. a search field). Fills the row and overrides
   *  `title`; give it flex so any right slot is pushed to the end. */
  children?: ReactNode;
  /** Search-style bar: a hairline divider below and a little more bottom room. */
  bordered?: boolean;
};

/**
 * The one top bar. Every pushed screen renders its back button through here, so the
 * chevron lands in exactly the same spot app-wide and header padding is never
 * hand-rolled (which is how it drifted before). The middle is a title, custom
 * content, or a spacer; the optional right slot holds trailing controls.
 */
export function ScreenHeader({ onBack, title, right, children, bordered }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, bordered && styles.bordered]}>
      {onBack ? <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={onBack} /> : null}
      {children ?? (title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      ))}
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // The app-wide back-button inset: gutter - 4 horizontal, 4 top. Because
    // IconButton centers its glyph in a 48px box, these two numbers are what pin
    // the chevron to the same spot on every screen.
    paddingHorizontal: space.gutter - 4,
    paddingTop: 4,
  },
  bordered: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink2,
  },
  title: { flex: 1, fontFamily: displayFamily, fontSize: typeScale.title, color: colors.paper },
  spacer: { flex: 1 },
});
