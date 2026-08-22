import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Pressable as RNPressable } from 'react-native';
import { useApp } from '../../src/store';

const PRESETS = [25, 50, 90] as const;

export default function FocusScreen() {
  const topics = useApp(s => s.topics);
  const finishFocus = useApp(s => s.finishFocus);
  const sessions = useApp(s => s.sessions);
  const streak = useApp(s => s.streak);

  const [preset, setPreset] = useState<number>(25);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(25 * 60);
  const [ratingFor, setRatingFor] = useState<string | null>(null); // topic id awaiting rating
  const elapsedRef = useRef(0);

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

  const start = () => { elapsedRef.current = preset * 60 - left; setRunning(true); };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setLeft(preset * 60); elapsedRef.current = 0; };

  const finish = () => {
    const minutes = Math.max(1, Math.round(elapsedRef.current / 60));
    setRunning(false);
    finishFocus({ topicId, minutes });
    setRatingFor(topicId ?? '__none__');   // sheet opens even without a topic (log-only)
    reset();
  };

  const rate = (r: 1 | 2 | 3) => {
    const tid = ratingFor === '__none__' ? null : ratingFor;
    if (tid) finishFocus({ topicId: tid, minutes: 0, rating: r }); // SRS move only (0 min won't log)
    setRatingFor(null);
  };

  const picked = topics.find(t => t.id === topicId);
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
      <View className="flex-row flex-wrap gap-2">
        {topics.length === 0 && <Text className="text-sm text-dim">No topics yet — complete onboarding.</Text>}
        {topics.slice(0, 8).map(t => (
          <Pressable
            key={t.id}
            onPress={() => setTopicId(t.id)}
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
      </View>

      {/* confidence sheet */}
      <Modal visible={ratingFor !== null} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl border-t border-line bg-surface p-6 pb-10">
            <Text className="text-center text-lg font-extrabold text-text">How did it go?</Text>
            <Text className="mt-1 text-center text-xs text-dim">drives your revision schedule</Text>
            <View className="mt-5 gap-2">
              <RateRow emoji='😵‍💫' label='Shaky' sub='show it to me again sooner' onPress={() => rate(1)} />
              <RateRow emoji='🚶' label='Getting there' sub='keep pace' onPress={() => rate(2)} />
              <RateRow emoji='💪' label='Solid' sub='I own this — next level' onPress={() => rate(3)} />
            </View>
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

function RateRow({ emoji, label, sub, onPress }: { emoji: string; label: string; sub: string; onPress: () => void }) {
  return (
    <RNPressable onPress={onPress} className="flex-row items-center rounded-2xl bg-surface-2 p-4 active:opacity-70">
      <Text className="text-2xl">{emoji}</Text>
      <View className="ml-3 flex-1">
        <Text className="font-bold text-text">{label}</Text>
        <Text className="text-xs text-dim">{sub}</Text>
      </View>
    </RNPressable>
  );
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
