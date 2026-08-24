import { View, Text, ScrollView, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store';
import { tNum, tNumStrong } from '../../src/ui/typography';

/* Cycle-1 L1+L3 polish (docs/ux-loop-cycle1.md): live date, next-up hero card,
   done-wash styling, reason-line gating, SVG progress ring, check-off haptics. */

const RING_R = 16;
const RING_CIRC = 2 * Math.PI * RING_R;
const COLOR_LINE = '#232C37'; // --color-line
const COLOR_DONE = '#4ADE80'; // --color-done

/** A reason is only worth showing when it explains WHY this block exists
 *  (exam-linked, carried from yesterday, or backlog) — "Not started yet" is noise. */
const isInformativeReason = (item: { carried?: boolean; examLinked?: boolean; topic: { backlog: boolean } }) =>
  Boolean(item.carried || item.examLinked || item.topic.backlog);

export default function TodayScreen() {
  const plan = useApp(s => s.plan);
  const doneUids = useApp(s => s.doneUids);
  const streak = useApp(s => s.streak);
  const topics = useApp(s => s.topics);

  // live derive from store (plan rebuilt when topics/exams change)
  const revs = plan.filter(p => p.kind === 'rev');
  const news = plan.filter(p => p.kind !== 'rev');
  const pct = plan.length ? Math.round((doneUids.size / plan.length) * 100) : 0;
  // first not-done block becomes the momentum hero (Hevy "up next" pattern)
  const nextUid = plan.find(p => !doneUids.has(p.uid))?.uid ?? null;

  // live date — no more hardcoded string (cycle-1 defect #5).
  // No board/class fields exist in the store yet, so the subtitle stays date-only.
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-text text-2xl font-extrabold tracking-tight">Abhyas</Text>
          <Text className="text-dim mt-1 text-[13px]">{today}</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            {/* L2: streak flame as an icon in the done-green accent (#10/#3) */}
            <Ionicons name='flame' size={16} color='#4ADE80' />
            <Text className="text-done font-extrabold" style={tNumStrong}>{streak.current}</Text>
          </View>
          <ProgressRing pct={pct} />
        </View>
      </View>

      {plan.length > 0 && (
        <Text className="text-dim mt-2 text-xs">{plan.length} blocks</Text>
      )}

      {revs.length > 0 && (
        <Text className="mt-6 mb-3 text-[13px] font-extrabold uppercase tracking-wider" style={{ color: '#F87171' }}>
          Revision due · {revs.length}
        </Text>
      )}
      {revs.map(item => (
        <PlanCard key={item.uid} uid={item.uid} hero={item.uid === nextUid} />
      ))}

      <Text className="mt-6 mb-3 text-[13px] font-extrabold uppercase tracking-wider text-text">
        Today's plan
      </Text>
      {news.map(item => (
        <PlanCard key={item.uid} uid={item.uid} hero={item.uid === nextUid} />
      ))}

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

function PlanCard({ uid, hero }: { uid: string; hero: boolean }) {
  const item = useApp(s => s.plan.find(p => p.uid === uid));
  const done = useApp(s => s.doneUids.has(uid));
  const checkItem = useApp(s => s.checkItem);
  if (!item) return null;

  const time = item.startMin == null
    ? 'anytime'
    : `${fmt(item.startMin)}–${fmt(item.startMin + item.durationMin)}`;
  const tagColor = item.carried ? '#FBBF24' : item.kind === 'rev' ? '#F87171' : '#8B7CF6';

  const onCheck = () => {
    // haptics fire on toggle-ON only; last block of the day gets its own beat.
    // try/catch + .catch so an unavailable haptics engine never blocks check-off.
    const state = useApp.getState();
    if (!state.doneUids.has(uid)) {
      const completesDay = state.plan.length > 0 &&
        state.plan.every(p => state.doneUids.has(p.uid) || p.uid === uid);
      try {
        if (completesDay) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } catch {
        // haptics unavailable (web / unsupported device) — silent by design
      }
    }
    checkItem(uid);
  };

  return (
    <Pressable
      onPress={onCheck}
      className={`mb-3 rounded-3xl border bg-surface active:opacity-80 ${
        hero ? 'border-accent border-2 p-5' : 'border-line p-4'
      }`}
      style={done ? { backgroundColor: 'rgba(74,222,128,0.12)' } : undefined}
    >
      <View className="flex-row items-center">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-2">
          <Text className="text-xl">{item.topic.subjectId}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text
            className={`font-bold ${done ? 'line-through opacity-50' : ''}`}
            style={{ color: done ? '#8B94A3' : '#E7EBF2' }}
          >
            {item.topic.name} — {item.carried ? 'catch-up' : item.kind === 'rev' ? 'revise' : 'focus'}
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: tagColor, ...tNum }}>
            {time} · {item.carried ? 'CARRIED' : item.kind === 'rev' ? 'DUE' : 'NEW'}
          </Text>
        </View>
        <View className={`h-7 w-7 items-center justify-center rounded-full border ${done ? 'border-done bg-done' : 'border-line'}`}>
          {done && <Ionicons name='checkmark' size={18} color='#0E1116' />}
        </View>
      </View>

      {hero && !done && (
        <View className="mt-3 flex-row items-center justify-between">
          <View className="rounded-full bg-accent/20 px-2.5 py-1">
            <Text className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#8B7CF6' }}>
              Up next
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/focus')}
            className="rounded-xl bg-accent px-4 py-2 active:opacity-80"
          >
            <Text className="text-xs font-extrabold" style={{ color: '#0E1116' }}>
              Start →
            </Text>
          </Pressable>
        </View>
      )}

      {item.why && !done && isInformativeReason(item) && (
        <View className="mt-2 flex-row items-center gap-1 rounded-xl bg-surface-2/60 p-2">
          <Ionicons name='pin-outline' size={14} color='#8B94A3' />
          <Text className="flex-1 text-xs text-dim">Why: {item.why}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Header progress ring (cycle-1 defect #1): done-green arc on a line-colored track,
 *  tiny tabular % centered over it. Pure SVG — no animation deps needed. */
function ProgressRing({ pct }: { pct: number }) {
  return (
    <View className="h-11 w-11 items-center justify-center">
      <Svg width={44} height={44}>
        <Circle cx={22} cy={22} r={RING_R} stroke={COLOR_LINE} strokeWidth={4} fill="none" />
        <Circle
          cx={22}
          cy={22}
          r={RING_R}
          stroke={COLOR_DONE}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
          strokeDashoffset={RING_CIRC * (1 - pct / 100)}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
      </Svg>
      <Text
        className="absolute text-done font-extrabold"
        style={{ fontSize: 10, ...tNumStrong }}
      >
        {pct}%
      </Text>
    </View>
  );
}

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
