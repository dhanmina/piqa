import { View, Text, Pressable } from 'react-native';
import { signInWithGoogle } from '../../lib/auth';

export default function SignIn() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Capture daily. Keep your streak. Peek into your past.</Text>
      <Pressable onPress={signInWithGoogle}>
        <Text>Sign in with Google</Text>
      </Pressable>
    </View>
  );
}
