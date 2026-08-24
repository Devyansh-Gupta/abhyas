import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Pressable as RNPressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/store';

const PRESETS = [25, 50, 90] as const;

// same chip visual as subjects.tsx rating chips
const RATINGS = [
  { r: 1 as const, emoji: '😵‍💫', label: 'Shaky', sub: 'show it to me again sooner' },
  { r: 2 as const, emoji: '🚶', label: 'Getting there', sub: 'keep pace' },
  { r: 3 as const, emoji: '💪', label: 'Solid', sub: 'I own this — next level' },
];

async function successHaptic() {
  try {
    const Haptics = await import('expo-haptics');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    // haptics unavailable — never block the flow on it
  }
}

export default function FocusScreen() {
  const topics = useApp(s => s.topics);
  const plan = useApp(s => s.plan);
  const finishFocus = useApp(s => s.finishFocus);
  const rateTopicAction = useApp(s => s.rateTopic);
  const rateByTopic = useApp(s => s.rateByTopic);
  const sessions = useApp(s => s.sessions);
  const streak = useApp(s => s.streak);

  // deep link: /focus?topicId=t_xxx pre-binds the session topic
  const { topicId: topicParam } = useLocalSearchParams<{ topicId?: string }>();

  const [preset, setPreset] = useState<number>(25);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(25 * 60);
  const [ratingFor, setRatingFor] = useState<string | null>(null); // topic id awaiting post-session rating
  const [warn, setWarn] = useState<string | null>(null);           // deep-link target missing
  const [postRateNote, setPostRateNote] = useState<string | null>(null); // visible no-op feedback
  const elapsedRef = useRef(0);

  const paramTopicId = Array.isArray(topicParam) ? topicParam[0] : topicParam;

  // apply deep-link binding; retry across hydration — warn visibly if topic doesn't exist
  useEffect(() => {
    if (!paramTopicId) return;
    const t = topics.find(x => x.id === paramTopicId);
    if (t) {
      setTopicId(paramTopicId);
      setWarn(null);
    } else if (topics.length > 0) {
      setWarn(`Deep-linked topic "${paramTopicId}" not found — starting unbound. Pick a topic below.`);
    }
    // topics empty → still hydrating; effect re-runs when topics arrive
  }, [paramTopicId, topics]);

  // countdown
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      elapsedRef.current += 1;
      setLeft(l => {
        if (l <= 1) {
          clearInterval(iv);
          setRunning(false);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  const start = () => { setPostRateNote(null); setWarn(null); elapsedRef.current = preset * 60 - left; setRunning(true); };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setLeft(preset * 60); elapsedRef.current = 0; };

  const finish = () => {
    const minutes = Math.max(1, Math.round(elapsedRef.current / 60));
    setRunning(false);
    finishFocus({ topicId, minutes });
    reset();
    // post-session confidence rating surfaces immediately (defect #14) — only when a topic is bound
    if (topicId && minutes > 0) setRatingFor(topicId);
  };

  const rate = (r: 1 | 2 | 3) => {
    const tid = ratingFor;
    setRatingFor(null);
    void successHaptic();
    if (!tid) return;
    // same canonical path as subjects.tsx: plan revision first, ladder fallback otherwise
    const uid = `t_${tid}`;
    if (plan.some(p => p.uid === uid && p.kind === 'rev')) {
      rateTopicAction(uid, r);
      return;
    }
    if (!rateByTopic(tid, r)) {
      // no silent no-ops: mastered topics can't move the ladder
      const name = topics.find(x => x.id === tid)?.name ?? tid;
      setPostRateNote(`${name} is already mastered — confidence noted, nothing to reschedule.`);
    }
  };

  const picked = topics.find(t => t.id === topicId);

  // chips show at most 8, but a bound/deep-linked topic is always kept visible
  const visibleTopics = useMemo(() => {
    const base = topics.slice(0, 8);
    if (topicId && !base.some(t => t.id === topicId)) {
      const sel = topics.find(t => t.id === topicId);
      if (sel) return [...base, sel];
    }
    return base;
  }, [topics, topicId]);

  const todayMin = sessions.reduce((a, s) => a + s.min, 0);

  return (
    <View className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Focus</Text>
      <Text className="mt-1 text-[13px] text-dim">
        {todayMin}m today · 🔥 {streak.current} day streak
      </Text>

      {/* presets */}
      <View className="mt-6 flex-row gap-2">
        {PRESETS.map(p => (
          <Pressable
            key={p}
            onPress={() => { setPreset(p); setLeft(p * 60); setRunning(false); }}
            className={`rounded-full border px-4 py-2 ${preset === p ? 'border-accent bg-accent/20' : 'border-line bg-surface'}`}
          >
            <Text style={{ color: preset === p ? '#8B7CF6' : '#8B94A3' }} className="text-xs font-bold">{p}m</Text>
          </Pressable>
        ))}
      </View>

      {/* topic picker */}
      <Text className="mb-2 mt-5 text-[13px] font-extrabold uppercase tracking-wider text-text">Studying</Text>
      {warn && (
        <Text className="mb-2 rounded-xl border border-due/40 bg-due/10 p-3 text-xs" style={{ color: '#F87171' }}>
          ⚠ {warn}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {topics.length === 0 && <Text className="text-sm text-dim">No topics yet — complete onboarding.</Text>}
        {visibleTopics.map(t => (
          <Pressable
            key={t.id}
            onPress={() => { setTopicId(t.id); setWarn(null); }}
            className={`rounded-full border px-3 py-2 ${topicId === t.id ? 'border-accent bg-accent/20' : 'border-line bg-surface'}`}
          >
            <Text style={{ color: topicId === t.id ? '#C9BFFF' : '#E7EBF2' }} className="text-xs">
              {t.subjectId} {t.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* timer */}
      <View className="mt-8 items-center rounded-3xl border border-line bg-surface py-10">
        <Text className="font-extrabold text-text" style={{ fontSize: 56, fontVariant: ['tabular-nums'] }}>
          {fmt(left)}
        </Text>
        <Text className="mt-1 text-xs text-dim">{picked ? `${picked.subjectId} ${picked.name}` : 'no topic bound — session still logs'}</Text>
        <View className="mt-6 flex-row gap-3">
          {!running
            ? <Btn label={left < preset * 60 ? '▶ Resume' : '▶ Start'} onPress={start} primary />
            : <Btn label='⏸ Pause' onPress={pause} primary />}
          <Btn label='✓ Finish' onPress={finish} />
          <Btn label='↺' onPress={reset} />
        </View>
        {postRateNote && (
          <Text className="mx-4 mt-4 text-center text-xs" style={{ color: '#F87171' }}>⚠ {postRateNote}</Text>
        )}
      </View>

      {/* post-session confidence sheet — only for bound sessions */}
      <Modal visible={ratingFor !== null} transparent animationType="slide" onRequestClose={() => setRatingFor(null)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl border-t border-line bg-surface p-6 pb-10">
            <Text className="text-center text-lg font-extrabold text-text">
              How confident do you feel about{'\n'}{picked ? `${picked.subjectId} ${picked.name}` : 'this topic'}?
            </Text>
            <Text className="mt-1 text-center text-xs text-dim">drives your revision schedule</Text>
            <View className="mt-5 gap-2">
              {RATINGS.map(({ r, emoji, label, sub }) => (
                <RNPressable
                  key={r}
                  onPress={() => rate(r)}
                  className="flex-row items-center rounded-2xl bg-surface-2 p-4 active:opacity-70"
                >
                  {/* same round chip as subjects.tsx */}
                  <View className="h-9 w-9 items-center justify-center rounded-full border border-line bg-surface active:bg-accent/30">
                    <Text className="text-sm">{emoji}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-bold text-text">{label}</Text>
                    <Text className="text-xs text-dim">{sub}</Text>
                  </View>
                </RNPressable>
              ))}
            </View>
            <Pressable onPress={() => setRatingFor(null)} className="mt-4 items-center py-2 active:opacity-60">
              <Text className="text-sm font-bold text-dim">Skip</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-2xl px-4 py-3 ${primary ? 'bg-accent' : 'bg-surface-2 border border-line'}`}
    >
      <Text className={`font-bold ${primary ? 'text-white' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
