import { Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { colors, spacing, type } from '../lib/theme';
import type { PendingRequest } from '../lib/buddies';

export function PendingRequestRow({
  request,
  onAccept,
  onDecline,
  busy,
}: {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const displayName = request.displayName ?? request.username;

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar url={request.avatarUrl} name={displayName} accessibilityLabel={`${displayName}'s profile photo`} />
        <Text style={{ ...type.bodyBold, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
          {displayName} wants to add you
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Accept" onPress={onAccept} disabled={busy} loading={busy} loadingLabel="Accepting..." />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Decline" variant="secondary" onPress={onDecline} disabled={busy} />
        </View>
      </View>
    </Card>
  );
}
