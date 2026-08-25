import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, ScrollView, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { weekdayFor } from '@abhyas/engine';
import { useApp } from '../../src/store';
import { tNum, tNumStrong } from '../../src/ui/typography';

/* Cycle-1 L1+L3 polish (docs/ux-loop-cycle1.md): live date, next-up hero card,
   done-wash styling, reason-line gating, SVG progress ring, check-off haptics. */

const RING_R = 16;
const RING_CIRC = 2 * Math.PI * RING_R;
const COLOR_LINE = '#232C37'; // --color-line
const COLOR_DONE = '#4ADE80'; // --color-done
/** Mon-first letters for the streak dot-row (cycle-2 #3). */
const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/* Cycle-3 lane A: subject avatar chips. The mobile store carries no subjects
 * table (subject identity is `topic.subjectId`, emoji-as-id in v1) and has no
 * color field, so chip colors come from the fallback path: hash the subject
 * key → fixed palette. Deterministic ⇒ same subject keeps the same color. */
const SUBJECT_PALETTE = ['#8B7CF6', '#4ADE80', '#F87171', '#FBBF24', '#38BDF8', '#F472B6'] as const;

const subjectColor = (key: string): string => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return SUBJECT_PALETTE[Math.abs(h) % SUBJECT_PALETTE.length];
};

/** Hex + alpha suffix (e.g. 18% ≈ 0x2E) for the chip's tinted background. */
const withAlpha = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

/** First Latin letter of the subject key, uppercase. Emoji keys (v1 ids) have
 *  no letter to show, so they fall back to the glyph itself — still color-coded. */
const initialFor = (key: string): string => {
  const m = key.match(/[A-Za-z]/);
  return m ? m[0].toUpperCase() : '';
};

/** 40px rounded-2xl square: subject color @18% bg, full-color bold initial centered. */
function SubjectAvatar({ subjectKey }: { subjectKey: string }) {
  const color = subjectColor(subjectKey);
  const initial = initialFor(subjectKey);
  return (
    <View
      accessibilityLabel={`Subject ${subjectKey}`}
      className='h-10 w-10 items-center justify-center rounded-2xl'
      style={{ backgroundColor: withAlpha(color, 0.18) }}
    >
      <Text className='font-extrabold' style={{ color, fontSize: initial ? 17 : 16 }}>
        {initial || subjectKey}
      </Text>
    </View>
  );
}

/** A reason is only worth showing when it explains WHY this block exists
 *  (exam-linked, carried from yesterday, or backlog) — "Not started yet" is noise. */
const isInformativeReason = (item: { carried?: boolean; examLinked?: boolean; topic: { backlog: boolean } }) =>
  Boolean(item.carried || item.examLinked || item.topic.backlog);

export default function TodayScreen() {
  const plan = useApp(s => s.plan);
  const doneUids = useApp(s => s.doneUids);
  const streak = useApp(s => s.streak);
  const topics = useApp(s => s.topics);
  const sessions = useApp(s => s.sessions);
  const todayIdx = useApp(s => s.dayIndex);

  // live derive from store (plan rebuilt when topics/exams change)
  const revs = plan.filter(p => p.kind === 'rev');
  const news = plan.filter(p => p.kind !== 'rev');
  const pct = plan.length ? Math.round((doneUids.size / plan.length) * 100) : 0;
  // first not-done block becomes the momentum hero (Hevy "up next" pattern)
  const nextUid = plan.find(p => !doneUids.has(p.uid))?.uid ?? null;
  const allDone = plan.length > 0 && doneUids.size === plan.length;

  // Cycle-2 #3: day-complete celebration — one subtle card, auto-dismiss after 4s.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!allDone) {
      setCelebrate(false);
      return;
    }
    setCelebrate(true);
    const t = setTimeout(() => setCelebrate(false), 4000);
    return () => clearTimeout(t); // cleanup so an uncheck mid-banner never leaks the timer
  }, [allDone]);

  // Streak weekly dots (cycle-2 #3): Mon..Sun of the CURRENT store-week.
  // weekdayFor maps a dayIndex to its weekday (0=Sun..6=Sat), so Monday of this
  // week is todayIdx minus how far past Monday we are.
  const mondayIdx = useMemo(
    () => todayIdx - ((weekdayFor(todayIdx) + 6) % 7),
    [todayIdx],
  );
  const studiedDays = useMemo(
    () => new Set(sessions.filter(s => s.min > 0).map(s => s.day)),
    [sessions],
  );
  // Sessions are the source of truth (every qualifying action logs one). If a
  // device has a streak but no session log at all, fall back to the streak tail:
  // e.g. current=3 → last 3 days ending today count as studied.
  const isStudiedDay = (d: number) =>
    studiedDays.has(d) ||
    (sessions.length === 0 && d <= todayIdx && d > todayIdx - streak.current);

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

      {/* cycle-2 #3: weekly dot-row under the streak flame — filled for studied days */}
      <View className="mt-2.5 flex-row gap-2">
        {WEEK_LETTERS.map((letter, i) => {
          const dayIdx = mondayIdx + i;
          const filled = isStudiedDay(dayIdx);
          return (
            <View key={i} className='w-4 items-center'>
              <View
                className='h-2 w-2 rounded-full'
                style={{
                  backgroundColor: filled ? COLOR_DONE : 'transparent',
                  borderWidth: filled ? 0 : 1.5,
                  borderColor: COLOR_LINE,
                }}
              />
              <Text className='text-dim mt-0.5 text-[9px]' style={tNum}>
                {letter}
              </Text>
            </View>
          );
        })}
      </View>

      {plan.length > 0 && (
        <Text className="text-dim mt-2 text-xs">{plan.length} blocks</Text>
      )}

      {/* cycle-2 #3 + cycle-3 lane A: day-complete moment — slides down + fades in */}
      {celebrate && <CelebrateBanner streak={streak.current} />}

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
        <View className="mt-16 items-center px-4">
          {topics.length === 0 ? (
            <>
              {/* cycle-2 #15: empty-state delight — icon block + friendly guide */}
              <View className='h-24 w-24 items-center justify-center rounded-3xl bg-surface-2'>
                <Ionicons name='book' size={48} color='#8B7CF6' />
              </View>
              <Text className='text-text mt-6 text-center text-xl font-extrabold tracking-tight'>
                Let&apos;s set up your syllabus
              </Text>
              <Text className='text-dim mt-2 text-center text-sm leading-5'>
                Pick your board, tick your subjects, and get today&apos;s plan in about a minute.
              </Text>
              <Pressable
                onPress={() => router.push('/onboarding')}
                className="mt-7 rounded-2xl bg-accent px-8 py-3.5 active:opacity-80"
              >
                <Text className="text-[15px] font-extrabold" style={{ color: '#0E1116' }}>
                  Start setup →
                </Text>
              </Pressable>
            </>
          ) : (
            <Text className="text-dim text-center text-sm">
              Topics loaded but no blocks today.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/** Cycle-3 lane A: day-complete banner (cycle-2 #3) with an entrance — slides
 *  down from -20px while fading in over 250ms. Pure presentation; the
 *  show/dismiss timing logic stays in TodayScreen. */
function CelebrateBanner({ streak }: { streak: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);
  return (
    <Animated.View
      accessibilityLabel={`Day complete. Streak is now ${streak}`}
      className='mt-4 flex-row items-center rounded-3xl border border-done/40 p-4'
      style={{
        backgroundColor: 'rgba(74,222,128,0.12)',
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
      }}
    >
      <Ionicons name='sparkles' size={20} color={COLOR_DONE} />
      <Text className='ml-2 flex-1 text-sm font-bold' style={{ color: COLOR_DONE }}>
        🎉 Day complete — streak is now {streak}
      </Text>
    </Animated.View>
  );
}

function PlanCard({ uid, hero }: { uid: string; hero: boolean }) {
  const item = useApp(s => s.plan.find(p => p.uid === uid));
  const done = useApp(s => s.doneUids.has(uid));
  const checkItem = useApp(s => s.checkItem);
  // cycle-3 lane A: spring pop on the check circle when the card flips to done.
  const checkScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!done) {
      checkScale.setValue(0);
      return;
    }
    checkScale.setValue(0);
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1.2, friction: 6, tension: 180, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, friction: 9, tension: 220, useNativeDriver: true }),
    ]).start();
  }, [done, checkScale]);
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
        {/* cycle-3 lane A: color-coded subject chip replaces the plain emoji square */}
        <SubjectAvatar subjectKey={item.topic.subjectId} />
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
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <View className={`h-7 w-7 items-center justify-center rounded-full border ${done ? 'border-done bg-done' : 'border-line'}`}>
            {done && <Ionicons name='checkmark' size={18} color='#0E1116' />}
          </View>
        </Animated.View>
      </View>

      {hero && !done && (
        <View className="mt-3 flex-row items-center justify-between">
          <View className="rounded-full bg-accent/20 px-2.5 py-1">
            <Text className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: '#8B7CF6' }}>
              Up next
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/focus?topicId=${item.topic.id}`)}
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
