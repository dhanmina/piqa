import { useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { setConsent, hasConsentRecord } from "@lib/analyticsConsent";
import { colors, fonts, overlay, radius, space, typeScale } from "@/components/tokens";
import { Button } from "@/components/atoms/Button";

const SCREEN_W = Dimensions.get("window").width;

/**
 * First-launch analytics consent notice. Renders as a centered card modal
 * (not a bottom sheet — this is a deliberate decision, not a secondary flow).
 * Shown once, on the first meaningful screen after install, then never again.
 * The user's choice persists via AsyncStorage and PostHog's opt-in/opt-out.
 */
export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasConsentRecord().then((decided) => {
      if (alive && !decided) setVisible(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const accept = async () => {
    await setConsent(true);
    setVisible(false);
  };

  const decline = async () => {
    await setConsent(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>Help make piqa better</Text>
          <Text style={styles.body}>
            We&apos;d like to collect anonymous usage data to understand how you use
            the app and fix issues faster. This never includes your photos,
            profile info, or anything tied to your identity.
          </Text>
          <View style={styles.actions}>
            <Button label="Allow" variant="primary" fullWidth onPress={accept} />
            <Pressable style={styles.declineButton} onPress={decline}>
              <Text style={styles.declineText}>No thanks</Text>
            </Pressable>
          </View>
          <Text style={styles.footnote}>You can change this anytime in Settings.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: overlay.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: space.gutter,
  },
  card: {
    width: "100%",
    maxWidth: Math.min(SCREEN_W - 48, 380),
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.body,
    color: colors.paper,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  declineButton: {
    alignItems: "center",
    paddingVertical: space.xsPlus,
  },
  declineText: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.sub,
    color: colors.paper40,
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper30,
    textAlign: "center",
  },
});
