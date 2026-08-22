import { buildDayPlan, type Topic } from '@abhyas/engine';

const TOPICS: Topic[] = [
  { id: 'quadratic', subjectId: '📐', name: 'Quadratic Equations', box: 1, dueIn: 0, weight: 10, coverage: 'in_progress', backlog: false },
  { id: 'trig', subjectId: '📐', name: 'Trigonometry', box: 0, dueIn: -1, weight: 12, coverage: 'unstarted', backlog: false },
];

export default function Today() {
  const plan = buildDayPlan(TOPICS, [], 0);
  return (
    <div style={{ background: '#0E1116', color: '#E7EBF2', minHeight: '100vh', padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontWeight: 800 }}>Abhyas <small style={{ color: '#8B7CF6' }}>· web preview</small></h1>
      <p style={{ color: '#8B94A3' }}>Read-only skeleton — full parity lands in v1.1 (ADR §C4).</p>
      {plan.map(item => (
        <div key={item.uid} style={{ background: '#151B23', borderRadius: 16, padding: 16, marginBottom: 10 }}>
          <b>{item.topic.name}</b> — {item.kind === 'rev' ? 'revise' : 'focus'}
          <div style={{ color: '#8B94A3', fontSize: 13 }}>{item.why}</div>
        </div>
      ))}
    </div>
  );
}
