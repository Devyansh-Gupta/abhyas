/**
 * Onboarding wizard (issue #4) — UI is a thin renderer over engine screenFor().
 * All gates/sequence live in the engine (golden-tested); this file only draws.
 */
import { useState, useReducer } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import {
  initOnboarding, reduce, canAdvance, stepCount, screenFor,
  type OnboardingState, type ScreenRole, type SubjectPick,
} from '@abhyas/engine/src/onboarding';
import { recalibrate } from '@abhyas/engine/src/marks';
import { presetsFor, topicsFromPreset } from '@abhyas/presets';
import { useApp } from '../src/store';

const BOARDS = ['CBSE', 'ICSE', 'State board'];
const CLASSES = [9, 10, 11, 12];
const STREAMS = ['Science', 'Commerce', 'Humanities', 'Vocational'] as const;
/** popularity-ordered electives (CBSE candidate counts; design doc §2.1) */
const ELECTIVES: SubjectPick[] = [
  { emoji: '🏃', name: 'Physical Education', kind: 'elective' },
  { emoji: '🎨', name: 'Painting', kind: 'elective' },
  { emoji: '🧠', name: 'Psychology', kind: 'elective' },
  { emoji: '🏠', name: 'Home Science', kind: 'elective' },
  { emoji: '💻', name: 'Computer Science', kind: 'elective' },
  { emoji: '📊', name: 'Economics', kind: 'elective' },
];
const COVERAGE_CHIPS: Array<{ label: string; frac: number }> = [
  { label: 'Not started', frac: 0 },
  { label: '¼ done', frac: 0.25 },
  { label: 'Half', frac: 0.5 },
  { label: '¾ done', frac: 0.75 },
  { label: 'Finished', frac: 1 },
];

export default function Onboarding() {
  const [s, dispatch] = useReducer(reduce, undefined, initOnboarding) as [OnboardingState, React.Dispatch<any>];
  const [customName, setCustomName] = useState('');
  const setState = useApp.setState;

  const total = stepCount(s);
  const role: ScreenRole = screenFor(s);
  const active: SubjectPick[] = s.subjects.filter((x: SubjectPick) => !x.removed);
  const ok = canAdvance(s);
  const presets = s.board && s.cls ? presetsFor(s.board, s.cls) : [];

  /** map a picked subject to a library preset when one exists */
  const presetForPick = (p: SubjectPick) => {
    if (s.board !== 'CBSE') return undefined;
    if (s.cls === 10 && p.name === 'Science') return presets.find(x => x.subject === 'Science');
    if (s.cls === 10 && p.name === 'Mathematics') return presets.find(x => x.subject === 'Mathematics');
    if (s.cls === 12 && p.name === 'Physics') return presets.find(x => x.subject === 'Physics');
    return undefined;
  };

  const finish = () => {
    const topics = [];
    for (const sub of active) {
      const preset = presetForPick(sub);
      if (preset) {
        const cov = s.coverage[sub.emoji] ?? 0;
        topics.push(...topicsFromPreset(preset, cov === 0 ? 'unstarted' : cov >= 0.75 ? 'covered' : 'in_progress').topics);
      }
      // subjects without a library preset (custom/electives) enter as bare topics
      else {
        topics.push({
          id: `custom-${sub.name.toLowerCase().replace(/\W+/g, '-')}`,
          subjectId: sub.emoji,
          name: sub.name,
          box: 0,
          dueIn: -1,
          weight: 5,
          coverage: (s.coverage[sub.emoji] ?? 0) === 0 ? 'unstarted' : (s.coverage[sub.emoji] ?? 0) >= 0.75 ? 'covered' : 'in_progress',
          backlog: false,
        });
      }
    }
    // baseline marks seed the ladder through the same engine path as tests
    let seeded = topics;
    for (const [emoji, pct] of Object.entries(s.baseline)) {
      if (!pct) continue;
      seeded = recalibrate(seeded as any, emoji, pct, s.learningStyle);
    }
    setState({
      topics: seeded as any,
      learningStyle: s.learningStyle,
      exams: useApp.getState().exams,
    });
    router.replace('/');
  };

  return (
    <ScrollView className="flex-1 bg-bg px-6 pt-16">
      <Text className="text-dim text-xs font-bold tracking-widest">STEP {Math.min(s.step + 1, total)} / {total}</Text>
      <Bar n={s.step} total={total} />

      {/* persona */}
      {role === 'persona' && (
        <>
          <H>Who's studying?</H>
          <Card selected><Text className="font-bold text-text">🎓 Class 9–12 student</Text></Card>
          <Card><Text className="line-through text-dim">🎒 Class 5–8 — soon</Text></Card>
          <Card><Text className="line-through text-dim">🎓 UG/PG — soon</Text></Card>
        </>
      )}

      {/* board & class */}
      {role === 'board' && (
        <>
          <H>Your board & class</H>
          <Row>{BOARDS.map(b => <Chip key={b} label={b} on={s.board === b} onPress={() => dispatch({ t: 'setBoard', board: b })} />)}</Row>
          <Row>{CLASSES.map(c => <Chip key={c} label={`Class ${c}`} on={s.cls === c} onPress={() => dispatch({ t: 'setClass', cls: c })} />)}</Row>
        </>
      )}

      {/* stream (11–12) */}
      {role === 'stream' && (
        <>
          <H>Your stream</H>
          <Row>{STREAMS.map(st => <Chip key={st} label={st} on={s.stream === st} onPress={() => dispatch({ t: 'setStream', s: st })} />)}</Row>
        </>
      )}

      {/* subject review — EDITABLE DRAFT (M1a) */}
      {role === 'subjects' && (
        <>
          <H>Your subjects</H>
          <Text className="-mt-3 mb-3 text-xs text-dim">Pre-ticked from your board — remove what you don't have, add what you do.</Text>
          {active.map((p: SubjectPick) => (
            <SubjToggle key={p.emoji} pick={p} removed={false} dispatch={dispatch} />
          ))}
          {s.subjects.filter((x: SubjectPick) => x.removed).map((p: SubjectPick) => (
            <SubjToggle key={`rm-${p.emoji}`} pick={p} removed dispatch={dispatch} />
          ))}
          <Text className="mb-2 mt-4 text-[13px] font-extrabold uppercase tracking-wider text-text">Electives & others</Text>
          <Row>
            {ELECTIVES.map(p => {
              const inList = s.subjects.some((x: SubjectPick) => x.emoji === p.emoji && !(x as SubjectPick).removed);
              return <Chip key={p.name} label={`${p.emoji} ${p.name}`} on={inList} onPress={() => dispatch({ t: 'toggleSubject', pick: p })} />;
            })}
          </Row>
          <Text className="mb-1 mt-4 text-[13px] font-extrabold uppercase tracking-wider text-text">Subject not listed?</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. Sanskrit, IT, Kannada…"
              placeholderTextColor="#5A6473"
              className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text"
            />
            <Pressable
              onPress={() => { dispatch({ t: 'addCustom', name: customName }); setCustomName(''); }}
              className="rounded-xl bg-accent px-4 py-2"
            >
              <Text className="font-bold text-white">Add</Text>
            </Pressable>
          </View>
          <Text className={`mt-3 text-xs ${active.length > 6 ? 'text-[#FBBF24]' : 'text-dim'}`}>
            {active.length} subjects{active.length >= 8 ? ' · max reached' : active.length > 6 ? " · that's a heavy load" : ''}
          </Text>
        </>
      )}

      {/* mid-year calibration (M1b) */}
      {role === 'coverage' && (
        <>
          <H>How far has school reached?</H>
          <Text className="-mt-3 mb-4 text-xs text-dim">One tap each — so plans match reality, not September.</Text>
          {active.map((sub: SubjectPick) => (
            <View key={sub.emoji} className="mb-4 rounded-2xl border border-line bg-surface p-3">
              <Text className="mb-2 font-bold text-text">{sub.emoji} {sub.name}</Text>
              <Row>
                {COVERAGE_CHIPS.map(c => (
                  <Chip
                    key={c.label}
                    small
                    label={c.label}
                    on={(s.coverage[sub.emoji] ?? 0) === c.frac}
                    onPress={() => dispatch({ t: 'setCoverage', emoji: sub.emoji, frac: c.frac })}
                  />
                ))}
              </Row>
            </View>
          ))}
        </>
      )}

      {/* baseline marks (M1c) */}
      {role === 'baseline' && (
        <>
          <H>Any recent scores? <Text className="text-sm font-normal text-dim">(optional)</Text></H>
          <Text className="-mt-3 mb-4 text-xs text-dim">Enter last exam's % to calibrate where revision starts. Skip freely.</Text>
          {active.map((sub: SubjectPick) => (
            <View key={sub.emoji} className="mb-3 flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
              <Text className="font-bold text-text">{sub.emoji} {sub.name}</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={3}
                placeholder="%"
                placeholderTextColor="#5A6473"
                onChangeText={txt => dispatch({ t: 'setBaseline', emoji: sub.emoji, pct: parseInt(txt || '0', 10) || 0 })}
                className="w-20 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-right text-text"
              />
            </View>
          ))}
        </>
      )}

      {/* exams (M1d minimal) */}
      {role === 'exams' && (
        <>
          <H>Upcoming exams?</H>
          <Text className="-mt-3 mb-4 text-xs text-dim">Just a name + month is enough — exact dates when the datesheet lands.</Text>
          <Card><Text className="text-text">📝 Add later from the Plan tab — nothing blocks you here.</Text></Card>
        </>
      )}

      {/* learning style dial (E2) */}
      {role === 'style' && (
        <>
          <H>How well do you remember what you study?</H>
          <RatePick label='😵‍💫 I forget fast — remind me sooner' v='fast_forget' cur={s.learningStyle} set={v => dispatch({ t: 'setStyle', style: v })} />
          <RatePick label='🚶 About average' v='average' cur={s.learningStyle} set={v => dispatch({ t: 'setStyle', style: v })} />
          <RatePick label='💪 I remember well — less repetition' v='strong_memory' cur={s.learningStyle} set={v => dispatch({ t: 'setStyle', style: v })} />
        </>
      )}

      {/* NAV */}
      <View className="mb-16 mt-8 flex-row items-center justify-between">
        <Pressable onPress={() => dispatch({ t: 'back' })} className="px-4 py-3">
          <Text className="text-dim">← Back</Text>
        </Pressable>
        <Pressable
          onPress={() => (ok ? (s.step >= total - 1 ? finish() : dispatch({ t: 'next' })) : null)}
          className={`rounded-2xl px-8 py-4 ${ok ? 'bg-accent' : 'bg-surface-2'}`}
        >
          <Text className={`font-extrabold ${ok ? 'text-white' : 'text-dim'}`}>
            {s.step >= total - 1 ? 'Enter Abhyas →' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* atoms */
function H({ children }: { children: React.ReactNode }) {
  return <Text className="mb-5 text-2xl font-extrabold text-text">{children}</Text>;
}
function Bar({ n, total }: { n: number; total: number }) {
  return (
    <View className="mb-6 mt-2 h-1 flex-row gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} className={`h-1 flex-1 rounded-full ${i <= n ? 'bg-accent' : 'bg-surface-2'}`} />
      ))}
    </View>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <View className="mb-4 flex-row flex-wrap gap-2">{children}</View>;
}
function Chip({ label, on, onPress, small }: { label: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border ${small ? 'px-3 py-1.5' : 'px-4 py-2'} ${on ? 'border-accent bg-accent/20' : 'border-line bg-surface'}`}
    >
      <Text style={{ color: on ? '#C9BFFF' : '#E7EBF2' }} className={`${small ? 'text-[11px]' : 'text-xs'} font-bold`}>{label}</Text>
    </Pressable>
  );
}
function Card({ children, selected }: { children: React.ReactNode; selected?: boolean }) {
  return (
    <View className={`mb-2 rounded-2xl border p-4 ${selected ? 'border-accent bg-accent/10' : 'border-line bg-surface'}`}>
      {children}
    </View>
  );
}
function SubjToggle({ pick, removed, dispatch }: { pick: SubjectPick; removed: boolean; dispatch: (a: any) => void }) {
  return (
    <Pressable
      onPress={() => dispatch({ t: 'toggleSubject', pick })}
      className={`mb-2 flex-row items-center rounded-2xl border p-3.5 ${removed ? 'border-line bg-surface opacity-45' : 'border-accent bg-accent/10'}`}
    >
      <Text className="mr-3 text-xl">{pick.emoji}</Text>
      <Text className="flex-1 font-bold" style={{ color: '#E7EBF2', textDecorationLine: removed ? 'line-through' : 'none' }}>
        {pick.name}
      </Text>
      <Text className="text-dim">{removed ? '+' : '✓'}</Text>
    </Pressable>
  );
}
function RatePick({ label, v, cur, set }: { label: string; v: string; cur: string; set: (v: any) => void }) {
  return (
    <Pressable onPress={() => set(v)} className={`mb-2 rounded-2xl border p-4 ${cur === v ? 'border-accent bg-accent/15' : 'border-line bg-surface'}`}>
      <Text className="text-text">{label}</Text>
    </Pressable>
  );
}

// local import to avoid circular top-level (engine exports it too)

