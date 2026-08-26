import { Tabs, router } from 'expo-router';
import { TabBar } from '../../components/TabBar';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
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
