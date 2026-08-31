import { View } from 'react-native';
import { spacing } from '../lib/theme';

const MARK_SIZE = 14;

// A corner registration tick — the plate-framing language shared by PeekBackCard
// and CapturedTodayCard so a photo reads as a filed record, not a social card.
export function RegistrationMark({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = corner === 'tl' || corner === 'tr';
  const isLeft = corner === 'tl' || corner === 'bl';
  return (
    <View
      style={{
        position: 'absolute',
        width: MARK_SIZE,
        height: MARK_SIZE,
        [isTop ? 'top' : 'bottom']: spacing.sm,
        [isLeft ? 'left' : 'right']: spacing.sm,
        borderColor: 'rgba(255,255,255,0.55)',
        borderTopWidth: isTop ? 1.5 : 0,
        borderBottomWidth: isTop ? 0 : 1.5,
        borderLeftWidth: isLeft ? 1.5 : 0,
        borderRightWidth: isLeft ? 0 : 1.5,
      }}
    />
  );
}
