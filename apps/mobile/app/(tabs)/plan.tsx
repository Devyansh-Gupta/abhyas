import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type ClassSession,
  buildWeekPlan, capacityMinutes, slotsForWeekday, busyPeriods, studyWindowFor,
  DAY_NAMES, DAY_SHORT, WEEKDAY_TODAY, weekdayFor,
} from '@abhyas/engine';
import { useApp } from '../../src/store';
import { fmtClock } from '../../src/ui/time';
import { tNum } from '../../src/ui/typography';

/** Prototype calendar anchor: Thu 2026-08-21 (engine's WEEKDAY_TODAY). */
const WEEK_ANCHOR = new Date('2026-08-21T00:00:00Z');
const ACCENT = '#8B7CF6';
const RED = '#F87171';

const hrs = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? `${min % 60}m` : ''}`;

export default function PlanScreen() {
  const topics = useApp(s => s.topics);
  const exams = useApp(s => s.exams);
  const classSessions = useApp(s => s.classSessions);
  const setClassSession = useApp(s => s.setClassSession);
  const moveClassPeriod = useApp(s => s.moveClassPeriod);
  const cancelClassPeriod = useApp(s => s.cancelClassPeriod);
  // c5 F6/F7: capacity knob + clock format preference
  const dailyHours = useApp(s => s.dailyHours);
  const timeFormat = useApp(s => s.timeFormat);

  // selected day of the visible week strip (0..6 = anchor + i)
  const [selDay, setSelDay] = useState(0);
  const [warn, setWarn] = useState<string | null>(null);

  const weekday = weekdayFor(selDay);

  // SAME-FRAME RE-SOLVE: pure derivation off store state — any timetable edit
  // (set/move/cancel) re-renders this memo synchronously, no reload, no effect.
  const weekPlan = useMemo(
    () => buildWeekPlan(topics, exams, classSessions, { dailyHours }),
    [topics, exams, classSessions, dailyHours],
  );

  const dayPeriods = useMemo(
    () =>
      classSessions
        .filter(s => s.weekday === weekday)
        .sort((a, b) => a.startMin - b.startMin),
    [classSessions, weekday],
  );
  const dayBlocks = weekPlan[selDay] ?? [];
  const free = capacityMinutes(classSessions, weekday, { window: studyWindowFor(dailyHours) });
  const slotCount = slotsForWeekday(classSessions, weekday, { window: studyWindowFor(dailyHours) }).length;
  const busy = busyPeriods(classSessions, weekday);

  const addClass = () => {
    setWarn(null);
    setClassSession({
      id: `p_${Date.now().toString(36)}`,
      subjectId: '📐',
      weekday,
      startMin: 17 * 60 + 30,
      endMin: 18 * 60 + 30,
    });
  };

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Plan</Text>
      <Text className="mt-1 text-[13px] text-dim">
        Week strip & timetable — edits re-solve your study plan instantly
      </Text>

      {/* --- week strip --- */}
      <View className="mt-4 flex-row justify-between">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(WEEK_ANCHOR.getTime() + i * 86_400_000);
          const on = i === selDay;
          return (
            <Pressable
              key={i}
              onPress={() => { setSelDay(i); setWarn(null); }}
              accessibilityLabel={`day-chip-${i}`}
              className={`h-16 w-11 items-center justify-center rounded-2xl border ${
                on ? 'border-accent' : 'border-line'
              }`}
              style={{ backgroundColor: on ? `${ACCENT}22` : '#161C25' }}
            >
              <Text className="text-xs" style={{ color: on ? ACCENT : '#8B94A3' }}>
                {DAY_SHORT[weekdayFor(i)]}
              </Text>
              <Text className={`text-base font-bold tabular-nums ${on ? '' : 'opacity-70'}`} style={{ color: '#E7EBF2', ...tNum }}>
                {d.getUTCDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-3 text-xs text-dim">
        Free study <Text style={{ color: '#4ADE80' }}>{hrs(free)}</Text> after{' '}
        {busy.length} class{busy.length === 1 ? '' : 'es'} · {slotCount} gap{slotCount === 1 ? '' : 's'}
        {selDay === 0 ? ' · today' : ''}
      </Text>

      {/* --- timetable editor --- */}
      <Text className="mb-2 mt-6 text-[13px] font-extrabold uppercase tracking-wider text-text">
        Classes · {DAY_NAMES[weekday]}
      </Text>

      {dayPeriods.map(p => (
        <View key={p.id} className="relative mb-2 overflow-hidden rounded-3xl border border-line bg-surface p-4 pl-5">
          {/* left color bar — distinguishes class rows from study blocks */}
          <View className="absolute bottom-0 left-0 top-0 w-[3px] bg-dim" />
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-2">
              <Text className="text-lg">{p.subjectId}</Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold" style={{ color: '#E7EBF2', ...tNum }}>
                {fmtClock(p.startMin, timeFormat)}–{fmtClock(p.endMin, timeFormat)}
              </Text>
              <Text className="text-xs text-dim">class period{p.room ? ` · ${p.room}` : ''}</Text>
            </View>
          </View>
          <View className="mt-3 flex-row justify-end gap-1.5">
            {/* move: shift both edges earlier/later */}
            <Chip label="−15" onPress={() => {
              if (!moveClassPeriod(p.id, { startMin: p.startMin - 15, endMin: p.endMin - 15 })) {
                setWarn(`Can't move before midnight.`);
              }
            }} />
            <Chip label="+15" onPress={() => {
              if (!moveClassPeriod(p.id, { startMin: p.startMin + 15, endMin: p.endMin + 15 })) {
                setWarn(`Can't move past midnight.`);
              }
            }} />
            {/* move: next weekday */}
            <Chip label="+1d" onPress={() => {
              moveClassPeriod(p.id, { weekday: (p.weekday + 1) % 7 });
            }} />
            {/* cancel */}
            <Chip label="Cancel" danger onPress={() => {
              setWarn(null);
              cancelClassPeriod(p.id);
            }} />
          </View>
        </View>
      ))}

      <Pressable
        onPress={addClass}
        className="mb-1 flex-row items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3 active:opacity-80"
        style={{ borderColor: '#2A3441' }}
      >
        <Ionicons name="add" size={16} color={ACCENT} />
        <Text className="text-sm font-semibold" style={{ color: ACCENT }}>Add class</Text>
      </Pressable>

      {/* --- derived plan for the selected day --- */}
      <Text className="mb-2 mt-6 text-[13px] font-extrabold uppercase tracking-wider text-text">
        Study plan · {DAY_NAMES[weekday]} <Text className="font-normal normal-case text-dim">· derived</Text>
      </Text>

      {dayBlocks.length === 0 && (
        <Text className="mt-2 text-center text-sm text-dim">
          Nothing to solve — complete onboarding to seed topics.
        </Text>
      )}
      {dayBlocks.map(item => (
        <View key={item.uid} className="mb-2.5 rounded-2xl border border-line bg-surface px-4 py-3">
          <View className="flex-row items-center">
            <Text className="mr-3 text-xs font-bold" style={{ color: item.kind === 'rev' ? RED : ACCENT, ...tNum }}>
              {item.startMin == null ? 'anytime' : fmtClock(item.startMin, timeFormat)}
            </Text>
            <Text className="flex-1 font-semibold" style={{ color: '#E7EBF2' }}>
              {item.topic.name} — {item.kind === 'rev' ? 'revise' : 'focus'} · {item.durationMin}m
            </Text>
          </View>
          {item.why && (
            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons name='pin-outline' size={14} color='#8B94A3' />
              <Text className="flex-1 text-[11px] text-dim">{item.why}</Text>
            </View>
          )}
        </View>
      ))}

      {warn && (
        <Text className="mb-4 mt-4 rounded-xl border border-due/40 bg-due/10 p-3 text-xs">
          ⚠ {warn}
        </Text>
      )}
    </ScrollView>
  );
}

function Chip({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-8 min-w-[44px] items-center justify-center rounded-full border border-line bg-surface-2 px-2 active:bg-accent/30"
    >
      <Text className="text-xs font-semibold" style={{ color: danger ? RED : '#E7EBF2' }}>{label}</Text>
    </Pressable>
  );
}
