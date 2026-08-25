/**
 * Onboarding wizard (issue #4) — UI is a thin renderer over engine screenFor().
 * All gates/sequence live in the engine (golden-tested); this file only draws.
 */
import { useState, useReducer, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  initOnboarding, reduce, canAdvance, stepCount, screenFor, recalibrate,
  buildDayPlan,
  type OnboardingState, type ScreenRole, type SubjectPick,
  type ClassPeriods, slotsForWeekday, weekdayFor, studyWindowFor, mergedClassSessions,
} from '@abhyas/engine';
import { presetsFor, topicsFromPreset } from '@abhyas/presets';
import { useApp, persist } from '../src/store';

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
  { label: 'Just getting started', frac: 0 },
  { label: 'About halfway through', frac: 0.5 },
  { label: 'Mostly done — revising', frac: 0.75 },
  { label: 'Finished — full revision mode', frac: 1 },
];

/* c5 L5: class-timetable step — manual per-day period editor (photo import later). */
const TIMETABLE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
/** '9' | '9.30' | '9:30' | '0930' → minutes-of-day, or null when not a real time. */
export function parseHM(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})(?:[:.]?(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
/** minutes-of-day → 'HH:MM'. */
export function fmtHM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export default function Onboarding() {
  const [s, dispatch] = useReducer(reduce, undefined, initOnboarding) as [OnboardingState, React.Dispatch<any>];
  const [customName, setCustomName] = useState('');
  // c5 L5: class-timetable step — local draft until finish() commits to the store
  const [classPeriods, setClassPeriods] = useState<ClassPeriods>({});
  const [ttDay, setTtDay] = useState(0); // index into TIMETABLE_DAYS; engine weekday = idx+1 (Mon=1)
  const setState = useApp.setState;

  // cycle-3 lane B: step-transition motion — fade + slide-in on every step change
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [s.step, enter]);
  const enterX = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

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
    const topics: import('@abhyas/engine').Topic[] = [];
    // ── c5 L1a: unique subject ids at seeding ────────────────────────────────
    // v1 used the emoji AS the subjectId, but glyphs collide (every custom
    // subject seeds as 📖, next to core English 📖) → duplicate React keys and
    // merged subject groups. The emoji stays the DISPLAY glyph; each picked
    // subject gets a minted-once id ('📖', '📖-2', …). Reducer state
    // (coverage/baseline) stays keyed by emoji — only seeded ids change, so
    // plan-item uids (t_<topicId>) stay stable.
    const usedIds = new Set<string>();
    const idOf = new Map<SubjectPick, string>();
    const uidFor = (sub: SubjectPick): string => {
      let id = sub.emoji;
      let n = 1;
      while (usedIds.has(id)) id = `${sub.emoji}-${++n}`;
      usedIds.add(id);
      return id;
    };
    // cycle-4 lane A: keep subject display identity (name; presets carry no
    // color today → undefined lets the UI hash-fallback palette apply)
    const subjectMeta: Record<string, { name: string; color?: string }> = {};
    for (const sub of active) {
      const sid = uidFor(sub);
      idOf.set(sub, sid);
      const preset = presetForPick(sub);
      subjectMeta[sid] = { name: preset?.subject ?? sub.name };
      if (preset) {
        const cov = s.coverage[sub.emoji] ?? 0;
        topics.push(...topicsFromPreset(preset, cov === 0 ? 'unstarted' : cov >= 0.75 ? 'covered' : 'in_progress').topics);
      }
      // subjects without a library preset (custom/electives) enter as bare topics
      else {
        topics.push({
          id: `custom-${sub.name.toLowerCase().replace(/\W+/g, '-')}`,
          subjectId: sid,
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
    // Baseline marks seed through the same engine path as tests — but keyed by
    // each subject's MINTED id (c5 L1a), since seeded topic.subjectId is that.
    for (const sub of active) {
      const pct = s.baseline[sub.emoji];
      if (!pct) continue;
      seeded = recalibrate(seeded as any, idOf.get(sub)!, pct, s.learningStyle);
    }
    setState({
      topics: seeded as any,
      subjectMeta,
      // F29 (#4): seed TODAY's plan too — store.plan starts [] and only
      // advanceDay() rebuilds it, so finishing onboarding previously landed
      // on an empty Today ("0 blocks") despite topics being in the store.
      // c5 L5: seed against real class-free slots (onboarding periods + Plan-tab sessions).
      plan: buildDayPlan(seeded as any, useApp.getState().exams, 0, {
        slots: slotsForWeekday(
          mergedClassSessions(useApp.getState().classSessions, classPeriods),
          weekdayFor(0),
          { window: studyWindowFor(useApp.getState().dailyHours) },
        ),
      }),
      classPeriods,
      learningStyle: s.learningStyle,
      exams: useApp.getState().exams,
    });
    // setState() bypasses the store's action wrappers, so persist() must be
    // invoked explicitly — otherwise onboarding results never reach SQLite (#8).
    persist();
    router.replace('/');
  };

  return (
    <ScrollView className="flex-1 bg-bg px-6 pt-16">
      <Text className="text-dim text-xs font-bold tracking-widest">STEP {Math.min(s.step + 1, total)} / {total}</Text>
      <Bar n={s.step} total={total} />

      {/* cycle-3 lane B: one motion wrapper for all step content */}
      <Animated.View style={{ opacity: enter, transform: [{ translateX: enterX }] }}>

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
          <Row>{BOARDS.map(b => <SelectableChip key={b} label={b} on={s.board === b} onPress={() => dispatch({ t: 'setBoard', board: b })} />)}</Row>
          <Row>{CLASSES.map(c => <SelectableChip key={c} label={`Class ${c}`} on={s.cls === c} onPress={() => dispatch({ t: 'setClass', cls: c })} />)}</Row>
        </>
      )}

      {/* stream (11–12) */}
      {role === 'stream' && (
        <>
          <H>Your stream</H>
          <Row>{STREAMS.map(st => <SelectableChip key={st} label={st} on={s.stream === st} onPress={() => dispatch({ t: 'setStream', s: st })} />)}</Row>
        </>
      )}

      {/* subject review — EDITABLE DRAFT (M1a) */}
      {role === 'subjects' && (
        <>
          <H>Your subjects</H>
          <Text className="-mt-3 mb-3 text-xs text-dim">Pre-ticked from your board — remove what you don't have, add what you do.</Text>
          {active.map((p: SubjectPick) => (
            <SubjToggle key={p.name} pick={p} removed={false} dispatch={dispatch} />
          ))}
          {s.subjects.filter((x: SubjectPick) => x.removed).map((p: SubjectPick) => (
            <SubjToggle key={`rm-${p.name}`} pick={p} removed dispatch={dispatch} />
          ))}
          <Text className="mb-2 mt-4 text-[13px] font-extrabold uppercase tracking-wider text-text">Electives & others</Text>
          <Row>
            {ELECTIVES.map(p => {
              const inList = s.subjects.some((x: SubjectPick) => x.emoji === p.emoji && !(x as SubjectPick).removed);
              return <SelectableChip key={p.name} label={`${p.emoji} ${p.name}`} on={inList} onPress={() => dispatch({ t: 'toggleSubject', pick: p })} />;
            })}
          </Row>
          <Text className="mb-1 mt-4 text-[13px] font-extrabold uppercase tracking-wider text-text">Subject not listed?</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. Sanskrit, IT, Kannada…"
              placeholderTextColor="#5A6473"
              style={{
                flex: 1,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#1C232D',
                backgroundColor: '#151B23',
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 14,
                color: '#E7EBF2',
              }}
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
          {/* c5 L2: concrete copy — what the answer decides for the plan */}
          <H>Where are your classes right now?</H>
          <Text className="-mt-3 mb-4 text-xs text-dim">This decides how much new learning vs revision your plan schedules.</Text>
          {/* c5 L1a: key by NAME — two picks can share a glyph (customs seed as 📖) */}
          {active.map((sub: SubjectPick) => (
            <View key={sub.name} className="mb-4 rounded-2xl border border-line bg-surface p-3">
              <Text className="mb-2 font-bold text-text">{sub.emoji} {sub.name}</Text>
              <Row>
                {COVERAGE_CHIPS.map(c => (
                  <SelectableChip
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
            <View key={sub.name} className="mb-3 flex-row items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
              <Text className="font-bold text-text">{sub.emoji} {sub.name}</Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={3}
                placeholder="%"
                placeholderTextColor="#5A6473"
                onChangeText={txt => dispatch({ t: 'setBaseline', emoji: sub.emoji, pct: parseInt(txt || '0', 10) || 0 })}
                style={{
                  width: 80,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#1C232D',
                  backgroundColor: '#1B2330',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  textAlign: 'right',
                  color: '#E7EBF2',
                }}
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
          {/* c5 L4: photo import entry point — exams land in the store via
              addExam and survive wizard finish (finish() keeps store exams). */}
          <Pressable
            onPress={() => router.push('/exam-import?return=onboarding')}
            accessibilityLabel="Import exams from a photo"
            className="mt-2 items-center rounded-2xl border border-line bg-surface py-3.5"
          >
            <Text className="text-sm font-bold text-dim">📷 Import from photo</Text>
          </Pressable>
        </>
      )}

      {/* class timetable (c5 L5) — manual grid editor, skippable */}
      {role === 'timetable' && (() => {
        const wd = ttDay + 1; // Mon=1 … Sun=6/0
        const list = classPeriods[wd] ?? [];
        const setList = (next: Array<{ startMin: number; endMin: number; label?: string }>) => {
          const all: ClassPeriods = { ...classPeriods };
          if (next.length > 0) all[wd] = next;
          else delete all[wd];
          setClassPeriods(all);
        };
        return (
          <>
            <H>When are you in class?</H>
            <Text className="-mt-3 mb-4 text-xs text-dim">
              Your plan studies around lectures, not through them. Skip if your timetable varies.
            </Text>
            <Row>
              {TIMETABLE_DAYS.map((d, i) => (
                <SelectableChip key={d} small label={d} on={ttDay === i} onPress={() => setTtDay(i)} />
              ))}
            </Row>
            {(list as Array<{ startMin: number; endMin: number }>).map((p, i) => (
              <PeriodRow
                key={i}
                period={p}
                onChange={(startMin, endMin) =>
                  setList(list.map((x, j) => (j === i ? { ...x, startMin, endMin } : x)) as any)
                }
                onRemove={() => setList(list.filter((_, j) => j !== i) as any)}
              />
            ))}
            <Pressable
              onPress={() => setList([...list, { startMin: 10 * 60, endMin: 10 * 60 + 50 }] as any)}
              accessibilityLabel={`Add a class period on ${TIMETABLE_DAYS[ttDay]}`}
              className="mt-2 items-center rounded-2xl border border-line bg-surface py-3"
            >
              <Text className="text-sm font-bold text-dim">+ Add period</Text>
            </Pressable>
            <Text className="mt-3 text-xs text-dim">
              {list.length === 0
                ? `No periods on ${TIMETABLE_DAYS[ttDay]} yet — that day stays fully free for study.`
                : `${list.length} period${list.length > 1 ? 's' : ''} on ${TIMETABLE_DAYS[ttDay]}. You can add the rest later from the Plan tab.`}
            </Text>
          </>
        );
      })()}

      {/* learning style dial (E2) */}
      {role === 'style' && (
        <>
          {/* cycle-3 lane B: final-step icon — same treatment as Today's empty state */}
          <View className="mb-5 h-24 w-24 items-center justify-center self-center rounded-3xl bg-surface-2">
            <Ionicons name='school' size={48} color='#8B7CF6' />
          </View>
          <H>How well do you remember what you study?</H>
          <RatePick label='😵‍💫 I forget fast — remind me sooner' v='fast_forget' cur={s.learningStyle} set={v => dispatch({ t: 'setStyle', style: v })} />
          <RatePick label='🚶 About average' v='average' cur={s.learningStyle} set={v => dispatch({ t: 'setStyle', style: v })} />
          <RatePick label='💪 I remember well — less repetition' v='strong_memory' cur={s.learningStyle} set={v => dispatch({ t: 'setStyle', style: v })} />
        </>
      )}

      </Animated.View>

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
        <BarSegment key={i} done={i < n} current={i === n} />
      ))}
    </View>
  );
}

/* cycle-3 lane B: completed = accent, current = pulsing accent, future = line */
function BarSegment({ done, current }: { done: boolean; current: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!current) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [current, opacity]);
  if (done) return <View className="h-1 flex-1 rounded-full bg-accent" />;
  if (current)
    return <Animated.View style={{ opacity }} className="h-1 flex-1 rounded-full bg-accent" />;
  return <View className="h-1 flex-1 rounded-full bg-surface-2" />;
}
function Row({ children }: { children: React.ReactNode }) {
  return <View className="mb-4 flex-row flex-wrap gap-2">{children}</View>;
}
/* cycle-3 lane B: shared selectable chip with a spring scale pulse on tap */
function SelectableChip({ label, on, onPress, small }: { label: string; on: boolean; onPress: () => void; small?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.05, speed: 40, bounciness: 4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 28, bounciness: 6, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        className={`rounded-full border ${small ? 'px-3 py-1.5' : 'px-4 py-2'} ${on ? 'border-accent bg-accent/20' : 'border-line bg-surface'}`}
      >
        <Text style={{ color: on ? '#C9BFFF' : '#E7EBF2' }} className={`${small ? 'text-[11px]' : 'text-xs'} font-bold`}>{label}</Text>
      </Pressable>
    </Animated.View>
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
/* c5 L5: one start/end row in the class-timetable editor. Owns its raw text
   state so typing '9:' mid-edit never fights the formatter; commits only
   valid, ordered times back to the day's list. */
function PeriodRow({
  period,
  onChange,
  onRemove,
}: {
  period: { startMin: number; endMin: number };
  onChange: (startMin: number, endMin: number) => void;
  onRemove: () => void;
}) {
  const [startText, setStartText] = useState(fmtHM(period.startMin));
  const [endText, setEndText] = useState(fmtHM(period.endMin));
  const commit = (sTxt: string, eTxt: string) => {
    const s = parseHM(sTxt);
    const e = parseHM(eTxt);
    if (s !== null && e !== null && s < e) onChange(s, e);
  };
  const inputStyle = {
    width: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1C232D',
    backgroundColor: '#1B2330',
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'center' as const,
    color: '#E7EBF2',
  };
  return (
    <View className="mb-2 flex-row items-center justify-between rounded-2xl border border-line bg-surface px-3 py-2.5">
      <TextInput
        value={startText}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        placeholder="10:00"
        placeholderTextColor="#5A6473"
        onChangeText={t => { setStartText(t); commit(t, endText); }}
        style={inputStyle}
      />
      <Text className="text-dim">–</Text>
      <TextInput
        value={endText}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        placeholder="10:50"
        placeholderTextColor="#5A6473"
        onChangeText={t => { setEndText(t); commit(startText, t); }}
        style={inputStyle}
      />
      <Pressable onPress={onRemove} accessibilityLabel="Remove period" hitSlop={8} className="px-2">
        <Text className="text-lg text-dim">✕</Text>
      </Pressable>
    </View>
  );
}

function RatePick({ label, v, cur, set }: { label: string; v: string; cur: string; set: (v: any) => void }) {  return (
    <Pressable onPress={() => set(v)} className={`mb-2 rounded-2xl border p-4 ${cur === v ? 'border-accent bg-accent/15' : 'border-line bg-surface'}`}>
      <Text className="text-text">{label}</Text>
    </Pressable>
  );
}

// local import to avoid circular top-level (engine exports it too)

