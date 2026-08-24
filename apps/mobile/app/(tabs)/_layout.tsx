import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';

// Cycle-1 L2 (#10/#11): one Ionicons set replaces the mixed emoji tab bar —
// consistent weight/size, accent tint when focused, dim otherwise.
const TAB_ICONS = {
  today: 'today',
  plan: 'calendar',
  focus: 'timer',
  subjects: 'library',
  progress: 'stats-chart',
} as const;

type TabName = keyof typeof TAB_ICONS;

function TabIcon({ name, focused }: { name: TabName; focused: boolean }) {
  return (
    <Ionicons
      name={TAB_ICONS[name]}
      size={23}
      color={focused ? '#8B7CF6' : '#8B94A3'}
    />
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
