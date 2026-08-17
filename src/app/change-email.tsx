/**
 * /change-email — reached from Settings > Account. double_confirm_changes is
 * on (supabase/config.toml), so GoTrue emails a code to BOTH the current and
 * new address before the change applies. Same code-entry shape as auth.tsx's
 * reset-password flow, requires the "Confirm Email Change" templates in the
 * Supabase dashboard to include {{ .Token }} (dashboard-only edit, not in
 * config.toml — see docs/build-roadmap.md's Account management entry).
 *
 * The code isn't tied to a known inbox in this UI — whichever email the user
 * opens first, they paste that code, and verifyOtp is tried against the new
 * address first then the current one. After a code lands, the session's
 * updated email is checked: if it doesn't match the requested address yet,
 * a second code (from the other inbox) is still needed.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@lib/session';
import { supabase } from '@lib/services/supabase';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, space, typeScale } from '@/components/tokens';

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('token') || m.includes('otp') || m.includes('expired')) {
    return "That code is wrong or expired. Check the email again, or request a new one.";
  }
  if (m.includes('already') && m.includes('regist')) return 'That email is already in use.';
  if (m.includes('already') && m.includes('exist')) return 'That email is already in use.';
  return message;
}

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { session } = useSession();
  const currentEmail = session?.user.email ?? '';

  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const trimmedNew = newEmail.trim();
  const canSend = trimmedNew.length > 3 && trimmedNew.includes('@') && trimmedNew.toLowerCase() !== currentEmail.toLowerCase();
  const canConfirm = code.trim().length >= 6;

  const onSend = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: trimmedNew });
    setBusy(false);
    if (error) return setToast(friendlyError(error.message));
    setStep('confirm');
    setToast('Check both your current and new inbox for a code');
  };

  const onConfirm = async () => {
    setBusy(true);
    const token = code.trim();
    // Either inbox's code lands here — try the new address first, since
    // that's the one most people check first, then fall back to current.
    let { data, error } = await supabase.auth.verifyOtp({ email: trimmedNew, token, type: 'email_change' });
    if (error && currentEmail) {
      ({ data, error } = await supabase.auth.verifyOtp({ email: currentEmail, token, type: 'email_change' }));
    }
    setBusy(false);
    if (error) return setToast(friendlyError(error.message));

    setCode('');
    if (data?.user?.email?.toLowerCase() === trimmedNew.toLowerCase()) {
      setToast('Email updated');
      router.back();
    } else {
      setToast('Confirmed — now enter the code from your other inbox');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Change email" />

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'request' ? (
          <>
            <Text style={styles.hint}>Current email: {currentEmail || '—'}</Text>
            <Field
              label="New email"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              placeholder="you@example.com"
              returnKeyType="go"
              onSubmitEditing={() => canSend && !busy && void onSend()}
            />
            <Button label="Send confirmation emails" onPress={() => void onSend()} loading={busy} disabled={!canSend} fullWidth />
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              We emailed a code to both {currentEmail} and {trimmedNew}. Enter either one below. You&apos;ll need both before the change is final.
            </Text>
            <Field
              label="Confirmation code"
              value={code}
              onChangeText={setCode}
              mono
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="6-digit code"
              returnKeyType="go"
              onSubmitEditing={() => canConfirm && !busy && void onConfirm()}
            />
            <Button label="Confirm" onPress={() => void onConfirm()} loading={busy} disabled={!canConfirm} fullWidth />
          </>
        )}
      </ScrollView>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} bottom={40} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: 16 },
  hint: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, lineHeight: 20 },
});
