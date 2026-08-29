import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { fetchProfile, setUsername as saveUsername, checkUsernameAvailable, updateDisplayName } from '../../lib/profile';
import { useUsernameAvailability, USERNAME_HINT } from '../../lib/useUsernameAvailability';
import { useAuthState } from '../../lib/authState';
import { colors, spacing, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { FilledField } from '../../components/FilledField';
import { FieldError } from '../../components/FieldError';
import { Button } from '../../components/Button';
import { OnboardingProgress } from '../../components/OnboardingProgress';

const USERNAME_FORMAT = /^[a-z0-9_]{3,20}$/;

export default function Username() {
  const [username, setUsernameInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { markUsernameSet } = useAuthState();
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchProfile().then(({ data }) => {
      if (data?.display_name) setDisplayName(data.display_name);
    });
  }, []);

  const usernameAvailability = useUsernameAvailability(username);
  const usernameError = usernameSaved
    ? null
    : (fieldError ??
      (usernameAvailability.state === 'invalid'
        ? usernameAvailability.message
        : usernameAvailability.state === 'taken'
          ? 'Taken'
          : usernameAvailability.state === 'error'
            ? 'Could not check'
            : null));
  const canSubmit = !loading && (usernameSaved || usernameAvailability.state === 'available');

  async function handleContinue() {
    setFormError(null);
    setFieldError(null);
    setLoading(true);

    if (!usernameSaved) {
      const normalizedUsername = username.trim().toLowerCase();
      if (!USERNAME_FORMAT.test(normalizedUsername)) {
        setLoading(false);
        setFieldError(USERNAME_HINT);
        return;
      }

      const { data: available, error: availabilityError } = await checkUsernameAvailable(normalizedUsername);
      if (availabilityError) {
        setLoading(false);
        setFormError(availabilityError.message);
        return;
      }
      if (!available) {
        setLoading(false);
        setFieldError('Taken');
        return;
      }

      const { error } = await saveUsername(normalizedUsername);
      if (error) {
        setLoading(false);
        setFormError(error.message);
        return;
      }
      setUsernameSaved(true);
    }

    if (displayName.trim()) {
      const { error } = await updateDisplayName(displayName);
      if (error) {
        setLoading(false);
        setFormError('Could not save name. Try again, or clear it to continue without one.');
        return;
      }
    }

    setLoading(false);
    router.push('/(onboarding)/intent');
    markUsernameSet();
  }

  return (
    <Screen>
      <OnboardingProgress step={1} total={3} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...type.screenTitle, color: colors.textPrimary, textAlign: 'center' }}>
              Choose a username
            </Text>
            <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
              This is how buddies find you on piqa.
            </Text>
          </View>

          <View style={{ gap: spacing.xs }}>
            <FilledField
              placeholder="Username"
              value={username}
              onChangeText={(v) => {
                setUsernameInput(v);
                setFieldError(null);
                setFormError(null);
                setUsernameSaved(false);
              }}
              textContentType="username"
              autoComplete="username-new"
              returnKeyType="next"
              onSubmitEditing={() => nameRef.current?.focus()}
              error={!!usernameError}
              editable={!loading}
            />
            <FieldError message={usernameError ?? formError} />
          </View>

          <FilledField
            ref={nameRef}
            placeholder="Name"
            value={displayName}
            onChangeText={setDisplayName}
            textContentType="name"
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            editable={!loading}
          />

          <Button label="Continue" loadingLabel="Saving…" onPress={handleContinue} disabled={!canSubmit} loading={loading} />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
