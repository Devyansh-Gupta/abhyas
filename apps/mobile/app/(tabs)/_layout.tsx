import { Tabs } from 'expo-router/tabs';
import { Text } from 'react-native';

const TAB_ICONS: Record<string, string> = {
  today: '☀️',
  plan: '🗓️',
  focus: '⏱️',
  subjects: '📚',
  progress: '📊',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>
      {TAB_ICONS[name] ?? '•'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8B7CF6',
        tabBarInactiveTintColor: '#8B94A3',
        tabBarStyle: { backgroundColor: '#10151C', borderTopColor: '#1C232D' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ focused }) => <TabIcon name="today" focused={focused} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: 'Plan', tabBarIcon: ({ focused }) => <TabIcon name="plan" focused={focused} /> }}
      />
      <Tabs.Screen
        name="focus"
        options={{ title: 'Focus', tabBarIcon: ({ focused }) => <TabIcon name="focus" focused={focused} /> }}
      />
      <Tabs.Screen
        name="subjects"
        options={{ title: 'Subjects', tabBarIcon: ({ focused }) => <TabIcon name="subjects" focused={focused} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarIcon: ({ focused }) => <TabIcon name="progress" focused={focused} /> }}
      />
    </Tabs>
  );
}
