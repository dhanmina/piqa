import { Tabs } from 'expo-router';

import { TabBar } from '@/components/molecules/TabBar';
import { colors } from '@/components/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="gallery" />
      <Tabs.Screen name="studios" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
