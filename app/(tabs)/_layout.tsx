import { Tabs, router } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen
        name="camera-action"
        options={{ title: '' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/capture');
          },
        }}
      />
      <Tabs.Screen name="buddies" options={{ title: 'Buddies' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
