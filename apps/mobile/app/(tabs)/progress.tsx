import { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { masteryBySubject } from '@abhyas/engine';
import { useApp } from '../../src/store';

export default function ProgressScreen() {
  const sessions = useApp(s => s.sessions);
  const streak = useApp(s => s.streak);
  const topics = useApp(s => s.topics);
  const dayIndex = useApp(s => s.dayIndex);

  // live derive from store — bars move when rating moves boxes (#7 acceptance)
  const mastery = useMemo(() => masteryBySubject(topics), [topics]);

  const totalMin = sessions.reduce((a, s) => a + s.min, 0);
  const todayMin = sessions.filter(s => s.day === dayIndex).reduce((a, s) => a + s.min, 0);
  const daysStudied = new Set(sessions.filter(s => s.min > 0).map(s => s.day)).size;

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Progress</Text>
      <Text className="mt-1 text-[13px] text-dim">live from your session log &amp; mastery ladder</Text>

      {/* streak + focus stats */}
      <View className="mt-6 flex-row gap-3">
        <Stat emoji='🔥' value={`${streak.current}`} label='day streak' />
        <Stat emoji='🏆' value={`${streak.longest}`} label='longest' />
      </View>
      <View className="mt-3 flex-row gap-3">
        <Stat emoji='⏱️' value={`${todayMin}m`} label='focused today' />
        <Stat emoji='📚' value={`${Math.round(totalMin / 60)}h ${totalMin % 60}m`} label='total focus' />
        <Stat emoji='📆' value={`${daysStudied}`} label='days studied' />
      </View>

      {/* per-subject mastery */}
      <Text className="mb-3 mt-7 text-[13px] font-extrabold uppercase tracking-wider text-text">
        Mastery by subject <Text className="font-normal normal-case text-dim">· avg box ÷ 5</Text>
      </Text>
      {mastery.length === 0 && (
        <Text className="mt-4 text-center text-sm text-dim">
          No subjects yet — complete onboarding to seed your syllabus.
        </Text>
      )}
      {mastery.map(m => (
        <View key={m.subjectId} className="mb-4 rounded-3xl border border-line bg-surface p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold" style={{ color: '#E7EBF2' }}>
              {m.subjectId} <Text className="text-xs font-normal text-dim">· {m.topics} topics</Text>
            </Text>
            <Text className="text-xs font-extrabold" style={{ color: m.pct >= 80 ? '#4ADE80' : '#C9BFFF' }}>
              {m.pct}%
            </Text>
          </View>
          <View className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, m.pct))}%`, backgroundColor: m.pct >= 80 ? '#4ADE80' : '#8B7CF6' }}
            />
          </View>
        </View>
      ))}

      {sessions.length === 0 && (
        <Text className="mt-2 text-center text-xs text-dim">
          No focus logged yet — run the timer in Focus and it lands here.
        </Text>
      )}
    </ScrollView>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-line bg-surface py-3">
      <Text className="text-lg">{emoji}</Text>
      <Text className="mt-0.5 font-extrabold tabular-nums" style={{ color: '#E7EBF2' }}>{value}</Text>
      <Text className="text-[11px] text-dim">{label}</Text>
    </View>
  );
}
