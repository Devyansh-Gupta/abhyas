import { View, Text, ScrollView } from 'react-native';
import { buildDayPlan, type Topic, type Exam } from '@abhyas/engine';

// P1 placeholder state — replaced by SQLite repo layer (issue #8)
const TOPICS: Topic[] = [
  { id: 'quadratic', subjectId: '📐', name: 'Quadratic Equations', box: 1, dueIn: 0, weight: 10, coverage: 'in_progress', backlog: false },
  { id: 'life', subjectId: '⚗️', name: 'Life Processes', box: 2, dueIn: 0, weight: 8, coverage: 'covered', backlog: true },
  { id: 'trig', subjectId: '📐', name: 'Trigonometry', box: 0, dueIn: -1, weight: 12, coverage: 'unstarted', backlog: false },
];
const EXAMS: Exam[] = [
  { id: 'ut1', name: 'Unit Test — Maths', kind: 'school', windowStart: '2026-08-27', subjectIds: ['📐'], datesheetConfirmed: false },
];

export default function TodayScreen() {
  const plan = buildDayPlan(TOPICS, EXAMS, 0);
  const revs = plan.filter(p => p.kind === 'rev');
  const news = plan.filter(p => p.kind === 'new');

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">
        Abhyas<span className="text-accent text-sm font-bold"> · by StudySync</span>
      </Text>
      <Text className="text-dim mt-1 text-[13px]">Thu, 21 Aug · CBSE Class 10 · Term 1</Text>

      {revs.length > 0 && (
        <Section title={`Revision due · ${revs.length} topic${revs.length > 1 ? 's' : ''}`} />
      )}
      {revs.map(item => <PlanCard key={item.uid} item={item} />)}

      <Section title="Today's plan" sub="derived from your day" />
      {news.map(item => <PlanCard key={item.uid} item={item} />)}
    </ScrollView>
  );
}

function Section({ title, sub }: { title: string; sub?: string }) {
  return (
    <View className="mt-6 mb-3 flex-row items-baseline justify-between">
      <Text className="text-text text-[13px] font-extrabold uppercase tracking-wider">{title}</Text>
      {sub && <Text className="text-dim text-[11px]">{sub}</Text>}
    </View>
  );
}

function PlanCard({ item }: { item: ReturnType<typeof buildDayPlan>[number] }) {
  const time =
    item.startMin == null
      ? 'anytime'
      : `${fmt(item.startMin)}–${fmt(item.startMin + item.durationMin)}`;
  const tag = item.kind === 'rev' ? 'DUE' : 'NEW';
  return (
    <View className="mb-3 rounded-3xl bg-surface p-4 border border-line">
      <View className="flex-row items-center">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-2">
          <Text className="text-xl">{item.topic.subjectId}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-text font-bold">{item.topic.name} — {item.kind === 'rev' ? 'revise' : 'focus'}</Text>
          <Text className="text-dim mt-0.5 text-xs">
            {time} · {tag}
          </Text>
        </View>
      </View>
      {item.why && (
        <Text className="mt-2 rounded-xl bg-surface-2/60 p-2 text-dim text-xs">📌 Why: {item.why}</Text>
      )}
    </View>
  );
}

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
