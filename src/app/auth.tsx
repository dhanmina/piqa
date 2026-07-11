import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@lib/supabase';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { displayFamily } from '@/components/fonts';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, space, typeScale } from '@/components/tokens';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'signup') {
        const name = username.trim().toLowerCase();
        if (name.length < 3) {
          setToast('Username needs at least 3 characters');
          return;
        }
        // Email confirm is OFF: signUp returns a live session. The DB trigger
        // creates the profiles + streaks rows from the username metadata.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: name } },
        });
        if (error) {
          setToast(error.message);
          return;
        }
        if (data.session) {
          // Capture device timezone; region stays 'BETA' while beta_mode=true.
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Manila';
          await supabase.from('profiles').update({ timezone }).eq('id', data.session.user.id);
        }
        // Session change flips the root layout guard → tabs.
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setToast(error.message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.wordmark}>Piqa</Text>
            <Text style={styles.tagline}>One shot. Every day.</Text>
          </View>

          <View style={styles.form}>
            {mode === 'signup' && (
              <Field
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="how curators will never see you"
              />
            )}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="at least 6 characters"
            />

            <View style={styles.submitRow}>
              <Button
                label={mode === 'signup' ? 'Create account' : 'Sign in'}
                onPress={() => void submit()}
                loading={busy}
                disabled={!email.trim() || password.length < 6}
                fullWidth
              />
            </View>

            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            >
              <Text style={styles.switchLine}>
                {mode === 'signup' ? 'Already shooting? Sign in' : 'New here? Create an account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} bottom={40} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space.gutter,
    gap: space.gutter * 2,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
  },
  wordmark: {
    fontFamily: displayFamily,
    fontSize: typeScale.display,
    color: colors.paper,
  },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
  },
  form: {
    gap: 16,
  },
  submitRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  switchLine: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
    padding: 10,
  },
});
