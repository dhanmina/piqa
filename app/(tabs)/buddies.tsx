import { StyleSheet, Text, View } from 'react-native';

export default function BuddiesScreen() {
  // Placeholder — Streak Buddy is a separate later plan, per the architecture spec.
  return (
    <View style={styles.container}>
      <Text>Buddies</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
