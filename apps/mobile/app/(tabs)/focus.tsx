import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Pressable as RNPressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/store';
import { toggleTopicId } from '../../src/lib/focus-session';
import { tNumStrong } from '../../src/ui/typography';

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
  // c5 L6 (F9): multi-topic sessions — ordered selection, deep link pre-selects one
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(25 * 60);
  // c5 L6: rating queue — each bound topic is rated sequentially after Finish
  const [ratingQueue, setRatingQueue] = useState<string[]>([]);
  const [warn, setWarn] = useState<string | null>(null);           // deep-link target missing
  const [postRateNote, setPostRateNote] = useState<string | null>(null); // visible no-op feedback
  const elapsedRef = useRef(0);

  const paramTopicId = Array.isArray(topicParam) ? topicParam[0] : topicParam;

  // apply deep-link binding; retry across hydration — warn visibly if topic doesn't exist
  useEffect(() => {
    if (!paramTopicId) return;
    const t = topics.find(x => x.id === paramTopicId);
    if (t) {
      setSelectedIds([paramTopicId]);
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

  // c5 L6: primary = first selected (deep-link target keeps priority); minutes are
  // attributed to ALL bound topics via the session entry's topicIds list.
  const topicId = selectedIds[0] ?? null;
  const picked = topics.find(t => t.id === topicId);

  const finish = () => {
    const minutes = Math.max(1, Math.round(elapsedRef.current / 60));
    setRunning(false);
    finishFocus({
      topicId,
      minutes,
      ...(selectedIds.length > 1 ? { topicIds: [...selectedIds] } : {}),
    });
    reset();
    // post-session confidence rating surfaces immediately (defect #14) — one sheet
    // per bound topic, sequential; skipped topics advance the queue without rating
    if (selectedIds.length > 0 && minutes > 0) setRatingQueue([...selectedIds]);
  };

  const rate = (r: 1 | 2 | 3) => {
    const tid = ratingQueue[0];
    setRatingQueue(q => q.slice(1)); // advance to the next bound topic
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

  // chips show at most 8; every bound topic stays visible
  const visibleTopics = useMemo(() => {
    const base = topics.slice(0, 8);
    const missing = selectedIds.filter(id => !base.some(t => t.id === id));
    if (missing.length === 0) return base;
    const extra = missing.map(id => topics.find(t => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
    return [...base, ...extra];
  }, [topics, selectedIds]);

  const todayMin = sessions.reduce((a, s) => a + s.min, 0);

  // progress bar fraction — derived from the existing countdown state, no new timers
  const totalSecs = preset * 60;
  const elapsedFrac = Math.min(1, Math.max(0, (totalSecs - left) / totalSecs));

  return (
    <View className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Focus</Text>
      <View className="mt-1 flex-row items-center gap-1">
        <Text className="text-[13px] text-dim">{todayMin}m today ·</Text>
        <Ionicons name="flame" size={14} color="#4ADE80" />
        <Text className="text-[13px] text-dim">{streak.current} day streak</Text>
      </View>

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
        {visibleTopics.map(t => {
          const on = selectedIds.includes(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => { setSelectedIds(ids => toggleTopicId(ids, t.id)); setWarn(null); }}
              className={`rounded-full border px-3 py-2 ${on ? 'border-accent' : 'border-line bg-surface'}`}
              style={on ? { backgroundColor: 'rgba(139,124,246,0.16)' } : undefined}
              accessibilityLabel={`${on ? 'Unbind' : 'Bind'} topic ${t.subjectId} ${t.name}`}
            >
              <Text style={{ color: on ? '#C9BFFF' : '#E7EBF2' }} className="text-xs">
                {t.subjectId} {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* timer */}
      <View className="mt-8 items-center rounded-3xl border border-line bg-surface px-8 py-10">
        <Text className="font-extrabold text-text" style={{ fontSize: 56, ...tNumStrong }}>
          {fmt(left)}
        </Text>
        {/* elapsed-fraction bar — track = line, fill = accent (no new timers; ticks off `left`) */}
        <View className="mt-4 h-1 w-full overflow-hidden rounded-full bg-line">
          <View
            className="h-full rounded-full"
            style={{ width: `${elapsedFrac * 100}%`, backgroundColor: '#8B7CF6' }}
          />
        </View>
        <Text className="mt-1 text-xs text-dim">
          {selectedIds.length === 0
            ? 'no topic bound — session still logs'
            : selectedIds.length === 1 && picked
              ? `${picked.subjectId} ${picked.name}`
              : `${selectedIds.length} topics bound — minutes split evenly`}
        </Text>
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

      {/* post-session confidence sheet — one per bound topic, sequential (c5 L6) */}
      <Modal visible={ratingQueue.length > 0} transparent animationType="slide" onRequestClose={() => setRatingQueue([])}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl border-t border-line bg-surface p-6 pb-10">
            {/* grab handle */}
            <View className="mb-4 h-1 w-9 self-center rounded-full bg-line" />
            {(() => {
              const current = topics.find(t => t.id === ratingQueue[0]);
              return (
                <>
                  <Text className="text-center text-lg font-extrabold text-text">
                    How confident do you feel about{'\n'}
                    {current ? `${current.subjectId} ${current.name}` : 'this topic'}?
                  </Text>
                  {ratingQueue.length > 1 && (
                    <Text className="mt-1 text-center text-xs text-dim">
                      {ratingQueue.length} topics to rate · Skip moves to the next
                    </Text>
                  )}
                </>
              );
            })()}
            <Text className={`mt-1 text-center text-xs text-dim ${ratingQueue.length > 1 ? 'hidden' : ''}`}>drives your revision schedule</Text>
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
            <Pressable onPress={() => setRatingQueue(q => q.slice(1))} className="mt-4 items-center py-2 active:opacity-60">
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
