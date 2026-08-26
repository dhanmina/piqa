import { View, Text, Pressable } from 'react-native';
import { signInWithGoogle } from '../../lib/auth';

export default function SignIn() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 24 }}>
      <Text style={{ fontSize: 16, textAlign: 'center' }}>Capture daily. Keep your streak. Peek into your past.</Text>
      <Pressable
        onPress={signInWithGoogle}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#1a1a1a' : '#000',
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: 8,
        })}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Sign in with Google</Text>
      </Pressable>
    </View>
  );
}
