import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@lib/supabase';
import { Brandmark } from '@/components/atoms/Brandmark';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { displayFamily } from '@/components/fonts';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, icons, space, typeScale } from '@/components/tokens';

type Mode = 'signin' | 'signup';

// Turn raw Supabase auth strings into something a person can act on.
function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login')) return "That email or password doesn't match.";
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('username')) return 'That username is taken. Try another.';
  if (m.includes('valid email') || m.includes('email address')) return "That email doesn't look right. Give it another look.";
  if (m.includes('network') || m.includes('fetch')) return 'Connection hiccup. Check your network and retry.';
  return raw;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && (!isSignup || username.trim().length >= 3);

  const submit = async () => {
    setBusy(true);
    try {
      if (isSignup) {
        const name = username.trim().toLowerCase();
        // Email confirm is OFF: signUp returns a live session. The DB trigger
        // creates the profiles + streaks rows from the username metadata.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: name } },
        });
        if (error) {
          setToast(friendlyError(error.message));
          return;
        }
        if (data.session) {
          // Capture device timezone; region stays 'BETA' while beta_mode=true.
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Manila';
          await supabase.from('profiles').update({ timezone }).eq('id', data.session.user.id);
        }
        // Session change flips the root layout guard → tabs.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setToast(friendlyError(error.message));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Brandmark size={64} />
            <Text style={styles.wordmark}>piqa</Text>
            <Text style={styles.tagline}>One shot. Every day.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.formHead}>
              <Text style={styles.formTitle}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
              <Text style={styles.formSub}>
                {isSignup ? 'One prompt a day. Your best shot.' : 'Sign in to pick up your streak.'}
              </Text>
            </View>

            {isSignup && (
              <Field
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="e.g. goldenhour"
                hint="This is public. People can find and follow you by it."
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
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="Your password"
              hint={isSignup ? 'At least 6 characters.' : undefined}
              rightSlot={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setShowPw((v) => !v)}
                >
                  {showPw ? (
                    <EyeOff size={18} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                  ) : (
                    <Eye size={18} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                  )}
                </Pressable>
              }
            />

            <View style={styles.submitRow}>
              <Button
                label={isSignup ? 'Create account' : 'Sign in'}
                onPress={() => void submit()}
                loading={busy}
                disabled={!canSubmit}
                fullWidth
              />
            </View>

            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setMode(isSignup ? 'signin' : 'signup')}
            >
              <Text style={styles.switchLine}>
                {isSignup ? 'Already shooting? ' : 'New here? '}
                <Text style={styles.switchAction}>{isSignup ? 'Sign in' : 'Create an account'}</Text>
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
  root: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space.gutter,
    gap: space.gutter * 2,
  },
  hero: { alignItems: 'center', gap: 10 },
  wordmark: {
    fontFamily: displayFamily,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1, // echoes the lockup's tight tracking
    color: colors.paper,
    marginTop: 2,
  },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    letterSpacing: 0.3,
  },
  form: { gap: 16 },
  formHead: { gap: 4, marginBottom: 2 },
  formTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.title,
    color: colors.paper,
  },
  formSub: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
  },
  submitRow: { alignItems: 'center', marginTop: 8 },
  switchLine: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
    padding: 10,
  },
  switchAction: { fontFamily: fonts.sansMedium, color: colors.safelight },
});
