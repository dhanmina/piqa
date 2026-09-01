import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { CameraFab } from '../../components/CameraFab';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="today" options={{ title: 'Today' }} />
        <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
        <Tabs.Screen name="buddies" options={{ title: 'Buddies' }} />
      </Tabs>
      <CameraFab />
    </View>
  );
}
