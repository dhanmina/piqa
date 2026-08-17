/**
 * /change-password — reached from Settings > Account. secure_password_change is
 * off (supabase/config.toml), so no reauth/current-password step is required —
 * same single-field shape as auth.tsx's reset flow, just without the OTP code.
 */
import { Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@lib/services/supabase';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
import { icons, space, colors } from '@/components/tokens';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canSave = password.length >= 6;

  const onSave = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setToast(error.message);
      return;
    }
    setToast('Password updated');
    setPassword('');
  };

  const pwToggle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
      hitSlop={14}
      onPress={() => setShowPw((v) => !v)}
    >
      {showPw ? (
        <EyeOff size={20} strokeWidth={icons.strokeWidth} color={colors.paper60} />
      ) : (
        <Eye size={20} strokeWidth={icons.strokeWidth} color={colors.paper60} />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Change password" />

      <ScrollView contentContainerStyle={styles.content}>
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Your new password"
          hint="At least 6 characters."
          rightSlot={pwToggle}
          returnKeyType="go"
          onSubmitEditing={() => canSave && !busy && void onSave()}
        />
        <Button label="Update password" onPress={() => void onSave()} loading={busy} disabled={!canSave} fullWidth />
      </ScrollView>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} bottom={40} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: 16 },
});
