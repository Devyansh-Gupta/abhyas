import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../src/store';

export default function TodayScreen() {
  const { plan, doneUids, streak, topics, exams } = useApp();
  const checkItem = useApp(s => s.checkItem);

  // live derive from store (plan rebuilt when topics/exams change)
  const revs = plan.filter(p => p.kind === 'rev');
  const news = plan.filter(p => p.kind !== 'rev');
  const pct = plan.length ? Math.round((doneUids.size / plan.length) * 100) : 0;

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-text text-2xl font-extrabold tracking-tight">Abhyas</Text>
          <Text className="text-dim mt-1 text-[13px]">Thu, 21 Aug · CBSE Class 10</Text>
        </View>
        <View className="items-end">
          <Text className="text-done font-extrabold">🔥 {streak.current}</Text>
          <Text className="text-dim text-[11px]">{pct}% today</Text>
        </View>
      </View>

      <Text className="text-dim mt-2 text-xs">
        {plan.length} blocks · derived from timetable, revisions & exams
      </Text>

      {revs.length > 0 && (
        <Text className="mt-6 mb-3 text-[13px] font-extrabold uppercase tracking-wider" style={{ color: '#F87171' }}>
          Revision due · {revs.length}
        </Text>
      )}
      {revs.map(item => <PlanCard key={item.uid} uid={item.uid} />)}

      <Text className="mt-6 mb-3 text-[13px] font-extrabold uppercase tracking-wider text-text">
        Today's plan <Text className="text-dim font-normal normal-case">· derived</Text>
      </Text>
      {news.map(item => <PlanCard key={item.uid} uid={item.uid} />)}

      {plan.length === 0 && (
        <View className="mt-10 items-center">
          <Text className="text-dim text-center text-sm">
            {topics.length === 0
              ? 'Welcome! Set up your syllabus to get your first plan.'
              : 'Topics loaded but no blocks today.'}
          </Text>
          {topics.length === 0 && (
            <Pressable
              onPress={() => router.push('/onboarding')}
              className="mt-4 rounded-2xl bg-accent px-6 py-3"
            >
              <Text className="text-[15px] font-extrabold" style={{ color: '#0E1116' }}>
                Start setup →
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function PlanCard({ uid }: { uid: string }) {
  const item = useApp(s => s.plan.find(p => p.uid === uid));
  const done = useApp(s => s.doneUids.has(uid));
  const checkItem = useApp(s => s.checkItem);
  if (!item) return null;

  const time = item.startMin == null
    ? 'anytime'
    : `${fmt(item.startMin)}–${fmt(item.startMin + item.durationMin)}`;
  const tagColor = item.carried ? '#FBBF24' : item.kind === 'rev' ? '#F87171' : '#8B7CF6';

  return (
    <Pressable
      onPress={() => checkItem(uid)}
      className="mb-3 rounded-3xl border border-line bg-surface p-4 active:opacity-80"
    >
      <View className="flex-row items-center">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-2">
          <Text className="text-xl">{item.topic.subjectId}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className={`font-bold ${done ? 'line-through opacity-50' : ''}`} style={{ color: '#E7EBF2' }}>
            {item.topic.name} — {item.carried ? 'catch-up' : item.kind === 'rev' ? 'revise' : 'focus'}
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: tagColor }}>
            {time} · {item.carried ? 'CARRIED' : item.kind === 'rev' ? 'DUE' : 'NEW'}
          </Text>
        </View>
        <View className={`h-7 w-7 items-center justify-center rounded-full border ${done ? 'border-done bg-done/20' : 'border-line'}`}>
          {done && <Text style={{ color: '#4ADE80' }}>✓</Text>}
        </View>
      </View>
      {item.why && !done && (
        <Text className="mt-2 rounded-xl bg-surface-2/60 p-2 text-xs text-dim">📌 Why: {item.why}</Text>
      )}
    </Pressable>
  );
}

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
