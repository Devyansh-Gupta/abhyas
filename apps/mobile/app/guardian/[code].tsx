import { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { decodeGuardianCode, guardianSummary } from '@abhyas/engine';
import { useApp } from '../../src/store';

/**
 * P2 parent link — guardian-facing READ-ONLY summary.
 * Opens from the student's shared deep link (`abhyas://guardian/<code>`).
 * The signed code is verified locally for now; the real handshake swaps in a
 * transport adapter later without touching this screen. Every rejection reason
 * renders visibly (F21/F24) — never a silent blank page.
 */
export default function GuardianScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const topics = useApp(s => s.topics);
  const sessions = useApp(s => s.sessions);
  const streak = useApp(s => s.streak);
  const dayIndex = useApp(s => s.dayIndex);

  const verdict = useMemo(
    () => decodeGuardianCode(code ?? '', { todayDay: dayIndex }),
    [code, dayIndex],
  );

  const summary = useMemo(
    () => (verdict.ok ? guardianSummary({ topics, sessions, streak, dayIndex }) : null),
    [verdict.ok, topics, sessions, streak, dayIndex],
  );

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Parent view</Text>
      <Text className="mt-1 text-[13px] text-dim">read-only · what your child is studying</Text>

      {!verdict.ok && (
        <View className="mt-8 rounded-3xl border border-due/40 bg-due/10 p-5">
          <Text className="text-base font-extrabold" style={{ color: '#F87171' }}>
            ⚠ This invite link doesn&apos;t work
          </Text>
          <Text className="mt-2 text-sm text-dim">{verdict.detail}</Text>
          <Text className="mt-3 text-xs text-dim">
            Reason: {verdict.reason}. Ask your child to share the invite again from Progress → Parent link.
          </Text>
        </View>
      )}

      {verdict.ok && summary && (
        <>
          {/* streak + weekly focus */}
          <View className="mt-6 flex-row gap-3">
            <Stat emoji='🔥' value={`${summary.streakCurrent}`} label='day streak' />
            <Stat emoji='🏆' value={`${summary.streakLongest}`} label='longest' />
            <Stat emoji='⏱️' value={`${summary.weeklyFocusMinutes}m`} label='this week' />
          </View>

          {/* per-subject mastery — same derivation as the student's own bars */}
          <Text className="mb-3 mt-7 text-[13px] font-extrabold uppercase tracking-wider text-text">
            Mastery by subject <Text className="font-normal normal-case text-dim">· avg box ÷ 5</Text>
          </Text>
          {summary.subjects.length === 0 && (
            <Text className="mt-4 text-center text-sm text-dim">
              No subjects yet — your child hasn&apos;t finished setup.
            </Text>
          )}
          {summary.subjects.map(m => (
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
                  style={{
                    width: `${Math.min(100, Math.max(0, m.pct))}%`,
                    backgroundColor: m.pct >= 80 ? '#4ADE80' : '#8B7CF6',
                  }}
                />
              </View>
            </View>
          ))}

          <Text className="mb-6 mt-1 text-center text-[11px] text-dim">
            {summary.masteredTopics}/{summary.totalTopics} topics mastered · invite valid through day {verdict.expiresDay}
          </Text>
        </>
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
