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

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

// Turn raw Supabase auth strings into something a person can act on.
function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login')) return "That email or password doesn't match.";
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('username')) return 'That username is taken. Try another.';
  if (m.includes('token') || m.includes('otp') || m.includes('expired')) return 'That code is wrong or expired. Request a new one.';
  if (m.includes('valid email') || m.includes('email address')) return "That email doesn't look right. Give it another look.";
  if (m.includes('network') || m.includes('fetch')) return 'Connection hiccup. Check your network and retry.';
  return raw;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const isSignin = mode === 'signin';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  // Clear transient fields on a mode change; keep email so it carries through.
  const go = (next: Mode) => {
    setMode(next);
    setPassword('');
    setCode('');
    setShowPw(false);
  };

  const title = isSignup
    ? 'Create your account'
    : isForgot
      ? 'Reset your password'
      : isReset
        ? 'Enter your code'
        : 'Welcome back';
  const sub = isSignup
    ? 'One prompt a day. Your best shot.'
    : isForgot
      ? "Enter your email and we'll send a reset code."
      : isReset
        ? `We emailed a code to ${email.trim() || 'your inbox'}. Enter it and pick a new password.`
        : 'Sign in to pick up your streak.';
  const buttonLabel = isSignup ? 'Create account' : isForgot ? 'Send reset code' : isReset ? 'Reset password' : 'Sign in';
  const canSubmit = isForgot
    ? email.trim().length > 0
    : isReset
      ? code.trim().length >= 6 && password.length >= 6
      : email.trim().length > 0 && password.length >= 6 && (!isSignup || username.trim().length >= 3);

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
        if (error) return setToast(friendlyError(error.message));
        if (data.session) {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Manila';
          await supabase.from('profiles').update({ timezone }).eq('id', data.session.user.id);
        }
      } else if (isForgot) {
        const em = email.trim();
        // Product choice: tell the user up front if there's no account (see the
        // email_exists migration for the enumeration tradeoff).
        const { data: exists, error: exErr } = await supabase.rpc('email_exists', { p_email: em });
        if (exErr) return setToast(friendlyError(exErr.message));
        if (!exists) return setToast('No account found for that email.');
        // Sends the recovery email. The template must include {{ .Token }} so the
        // code below can be entered; the same address is verified in the next step.
        const { error } = await supabase.auth.resetPasswordForEmail(em);
        if (error) return setToast(friendlyError(error.message));
        setToast('Reset code sent. Check your email.');
        setMode('reset');
        setPassword('');
        setCode('');
      } else if (isReset) {
        // The recovery code opens a short-lived session; then set the new password.
        const { error: vErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
        if (vErr) return setToast(friendlyError(vErr.message));
        const { error: uErr } = await supabase.auth.updateUser({ password });
        if (uErr) return setToast(friendlyError(uErr.message));
        setToast('Password updated. You’re in.');
        // Session is now live → the root guard flips to the tabs.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setToast(friendlyError(error.message));
      }
    } finally {
      setBusy(false);
    }
  };

  const pwToggle = (
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
  );

  const switchLine = isReset ? (
    // Recovery path: a typo or unregistered email lands here with no code coming,
    // so make it easy to correct the address (which also resends) or bail out.
    <View style={styles.resetSwitch}>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={() => go('forgot')}>
        <Text style={styles.switchLine}>
          Didn’t get a code? <Text style={styles.switchAction}>Change your email</Text>
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={() => go('signin')}>
        <Text style={styles.switchLineMuted}>Back to sign in</Text>
      </Pressable>
    </View>
  ) : isForgot ? (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={() => go('signin')}>
      <Text style={styles.switchLine}>
        Remembered it? <Text style={styles.switchAction}>Sign in</Text>
      </Text>
    </Pressable>
  ) : (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={() => go(isSignup ? 'signin' : 'signup')}>
      <Text style={styles.switchLine}>
        {isSignup ? 'Already shooting? ' : 'New here? '}
        <Text style={styles.switchAction}>{isSignup ? 'Sign in' : 'Create an account'}</Text>
      </Text>
    </Pressable>
  );

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
              <Text style={styles.formTitle}>{title}</Text>
              <Text style={styles.formSub}>{sub}</Text>
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

            {!isReset && (
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
            )}

            {isReset && (
              <Field
                label="Reset code"
                value={code}
                onChangeText={setCode}
                mono
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="6-digit code"
              />
            )}

            {!isForgot && (
              <Field
                label={isReset ? 'New password' : 'Password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete={isSignin ? 'current-password' : 'new-password'}
                placeholder="Your password"
                hint={isSignup || isReset ? 'At least 6 characters.' : undefined}
                rightSlot={pwToggle}
              />
            )}

            {isSignin && (
              <Pressable accessibilityRole="button" hitSlop={8} style={styles.forgotWrap} onPress={() => go('forgot')}>
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>
            )}

            <View style={styles.submitRow}>
              <Button label={buttonLabel} onPress={() => void submit()} loading={busy} disabled={!canSubmit} fullWidth />
            </View>

            {switchLine}
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
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4 },
  forgot: { fontFamily: fonts.sansMedium, fontSize: typeScale.caption, color: colors.paper60 },
  submitRow: { alignItems: 'center', marginTop: 8 },
  switchLine: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
    padding: 10,
  },
  switchAction: { fontFamily: fonts.sansMedium, color: colors.safelight },
  resetSwitch: { alignItems: 'center', gap: 2 },
  switchLineMuted: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper40,
    textAlign: 'center',
    padding: 6,
  },
});
