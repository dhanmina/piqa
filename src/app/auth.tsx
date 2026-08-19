import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRememberedEmail, getRememberMe, setRememberedEmail, setRememberMe } from '@lib/utils/authPrefs';
import { signInWithGoogle } from '@lib/services/auth';
import { supabase } from '@lib/services/supabase';
import { useUsernameStatus, usernameStatusMessage } from '@lib/username';
import { Brandmark } from '@/components/atoms/Brandmark';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { Toggle } from '@/components/atoms/Toggle';
import { displayFamily } from '@/components/fonts';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, icons, space, typeScale } from '@/components/tokens';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

// AuthError (extends Error) and PostgrestError (a plain object, from .rpc()
// calls like email_exists) both carry message/code but don't share a base
// class — check shape, not instanceof, so both are read correctly.
function hasMessage(e: unknown): e is { message: string; code?: string } {
  return typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string';
}

// Turn a raw Supabase auth error into something a person can act on. Takes the
// error itself (not just its message) so the identity-linking cases below can
// match on `.code` — a string like "manual linking is disabled" doesn't
// reliably say WHY, but the code always does.
function friendlyError(err: unknown): string {
  const raw = hasMessage(err) ? err.message : String(err);
  const code = hasMessage(err) ? err.code : undefined;
  // Google (or any social provider) sign-in where the email already belongs to
  // an existing account: GoTrue only auto-links onto it when that account's
  // email is confirmed. If it isn't (or manual linking is off, our default —
  // see supabase/config.toml), it throws one of these instead of silently
  // merging into a stranger-controlled account.
  if (code === 'manual_linking_disabled' || code === 'identity_already_exists') {
    return 'That email already has a piqa account. Sign in with your password instead.';
  }
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
  const [remember, setRemember] = useState(true); // stay signed in across restarts; opt out on a shared device
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Refs let the keyboard's "next" jump email → password without leaving it.
  const emailRef = useRef<any>(null);
  const passwordRef = useRef<any>(null);
  // The remembered email is a sign-in convenience. Track whether the user has
  // actually typed in the field so we never force the auto-fill into sign-up.
  const rememberedEmail = useRef('');
  const [emailEdited, setEmailEdited] = useState(false);

  // Restore the saved "remember me" choice (and, if on, the email) so the toggle
  // reflects what the user last chose instead of resetting to on every visit.
  useEffect(() => {
    void (async () => {
      const [saved, savedEmail] = await Promise.all([getRememberMe(), getRememberedEmail()]);
      setRemember(saved);
      if (saved && savedEmail) {
        rememberedEmail.current = savedEmail;
        setEmail(savedEmail); // prefill sign-in only (the screen opens in sign-in)
      }
    })();
  }, []);

  // Persist the choice the moment it's toggled — not only on submit — so it sticks
  // even if the user flips it and leaves. Clearing it also drops the saved email.
  const onRememberChange = (next: boolean) => {
    setRemember(next);
    void setRememberMe(next);
    if (!next) void setRememberedEmail(null);
  };

  const isSignup = mode === 'signup';
  const isSignin = mode === 'signin';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  // Live availability under the username field (sign-up only).
  const uStatus = useUsernameStatus(username, isSignup);
  const uMessage = usernameStatusMessage(uStatus);

  // Clear transient fields on a mode change; keep email so it carries through.
  const go = (next: Mode) => {
    setMode(next);
    setPassword('');
    setCode('');
    setShowPw(false);
    // If the email is still the untouched remembered value, don't drag it into
    // sign-up (you'd be creating a DIFFERENT account) — start that flow blank, and
    // restore the convenience fill on the way back to sign-in. A typed email always
    // carries, as before.
    if (!emailEdited) {
      if (next === 'signup') setEmail('');
      else if (next === 'signin') setEmail(rememberedEmail.current);
    }
  };

  const onEmailChange = (text: string) => {
    setEmail(text);
    setEmailEdited(true);
  };

  const title = isSignup
    ? 'Create your account'
    : isForgot
      ? 'Reset your password'
      : isReset
        ? 'Enter your code'
        : 'Welcome back';
  const sub = isSignup
    ? 'One theme a day. Your best shot.'
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
      : email.trim().length > 0 &&
        password.length >= 6 &&
        (!isSignup || (username.trim().length >= 3 && uStatus !== 'taken' && uStatus !== 'checking'));

  const submit = async () => {
    setBusy(true);
    try {
      if (isSignup) {
        await setRememberMe(true); // a fresh account stays signed in
        const name = username.trim().toLowerCase();
        // The DB trigger creates the profiles + streaks rows from the username metadata.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: name } },
        });
        if (error) return setToast(friendlyError(error));
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Manila';
        await supabase.from('profiles').update({ timezone }).eq('id', data.session!.user.id);
        await setRememberedEmail(email.trim());
        setToast('Welcome to piqa!');
      } else if (isForgot) {
        const em = email.trim();
        // Product choice: tell the user up front if there's no account (see the
        // email_exists migration for the enumeration tradeoff).
        const { data: exists, error: exErr } = await supabase.rpc('email_exists', { p_email: em });
        if (exErr) return setToast(friendlyError(exErr));
        if (!exists) return setToast('No account found for that email.');
        // Sends the recovery email. The template must include {{ .Token }} so the
        // code below can be entered; the same address is verified in the next step.
        const { error } = await supabase.auth.resetPasswordForEmail(em);
        if (error) return setToast(friendlyError(error));
        setToast('Reset code sent. Check your email.');
        setMode('reset');
        setPassword('');
        setCode('');
      } else if (isReset) {
        // The recovery code opens a short-lived session; then set the new password.
        const { error: vErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
        if (vErr) return setToast(friendlyError(vErr));
        const { error: uErr } = await supabase.auth.updateUser({ password });
        if (uErr) return setToast(friendlyError(uErr));
        await setRememberMe(true); // just recovered — don't sign them straight back out
        setToast('Password updated. You’re in.');
        // Session is now live → the root guard flips to the tabs.
      } else {
        await setRememberMe(remember);
        await setRememberedEmail(remember ? email : null);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setToast(friendlyError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  // Submit from the keyboard's return key, but only when the form would accept it.
  const trySubmit = () => {
    if (canSubmit && !busy) void submit();
  };

  // Same account either way — Supabase creates the row on first Google login,
  // so there's no separate sign-in-vs-sign-up branch here like the form above.
  const onGoogle = async () => {
    setGoogleBusy(true);
    try {
      const result = await signInWithGoogle();
      // Google has no remember-me toggle, so always remember — otherwise a
      // stale "0" from a prior password-form opt-out (no UI to undo it here)
      // silently signs the user back out on the next cold launch.
      if (result !== null) await setRememberMe(true);
      // A plain cancel (null) needs no toast; a real session change is picked
      // up by the root auth listener, which navigates — nothing to do here either.
    } catch (e) {
      setToast(friendlyError(e));
    } finally {
      setGoogleBusy(false);
    }
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
      {/* Keep the focused field above the keyboard on both platforms. The
          KeyboardAvoidingView padding pushes content up; keyboardVerticalOffset
          accounts for the SafeAreaView so the calculation is accurate. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={insets.top}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
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

            {(isSignin || isSignup) && (
              <>
                <Button
                  label="Continue with Google"
                  variant="ghost"
                  fullWidth
                  onPress={() => void onGoogle()}
                  loading={googleBusy}
                  disabled={busy || googleBusy}
                />
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            {isSignup && (
              <View style={styles.usernameBlock}>
                <Field
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="e.g. goldenhour"
                  hint={username.trim().length === 0 ? 'This is public. People can find and follow you by it.' : undefined}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
                {uMessage && (
                  <Text style={[styles.uStatus, uMessage.error && styles.uStatusError]}>{uMessage.text}</Text>
                )}
              </View>
            )}

            {!isReset && (
              <Field
                ref={emailRef}
                label="Email"
                value={email}
                onChangeText={onEmailChange}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                placeholder="you@example.com"
                returnKeyType={isForgot ? 'go' : 'next'}
                blurOnSubmit={isForgot}
                onSubmitEditing={isForgot ? trySubmit : () => passwordRef.current?.focus()}
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
                textContentType="oneTimeCode"
                placeholder="6-digit code"
              />
            )}

            {!isForgot && (
              <Field
                ref={passwordRef}
                label={isReset ? 'New password' : 'Password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete={isSignin ? 'current-password' : 'new-password'}
                textContentType={isSignin ? 'password' : 'newPassword'}
                placeholder="Your password"
                hint={isSignup || isReset ? 'At least 6 characters.' : undefined}
                rightSlot={pwToggle}
                returnKeyType="go"
                onSubmitEditing={trySubmit}
              />
            )}

            {isSignin && (
              <View style={styles.signinRow}>
                <Toggle compact label="Remember me" value={remember} onChange={onRememberChange} />
                <Pressable
                  accessibilityRole="button"
                  hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                  onPress={() => go('forgot')}
                >
                  <Text style={styles.forgot}>Forgot password?</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.submitRow}>
              <Button
                label={buttonLabel}
                onPress={() => void submit()}
                loading={busy}
                disabled={!canSubmit || googleBusy}
                fullWidth
              />
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
  hero: { alignItems: 'center', gap: space.xsPlus },
  wordmark: {
    fontFamily: displayFamily,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1, // echoes the lockup's tight tracking
    color: colors.paper,
    marginTop: space.hair,
  },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    letterSpacing: 0.3,
  },
  form: { gap: 16 },
  usernameBlock: { gap: space.xxsPlus },
  uStatus: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  uStatusError: { color: colors.safelight },
  formHead: { gap: 4, marginBottom: space.hair },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30 },
  dividerText: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
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
  signinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  forgot: { fontFamily: fonts.sansMedium, fontSize: typeScale.caption, color: colors.paper60 },
  submitRow: { alignItems: 'center', marginTop: 8 },
  switchLine: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
    padding: space.xsPlus,
  },
  switchAction: { fontFamily: fonts.sansMedium, color: colors.safelight },
  resetSwitch: { alignItems: 'center', gap: space.hair },
  switchLineMuted: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
    textAlign: 'center',
    padding: space.xxsPlus,
  },
});
