import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { type Topic } from '@abhyas/engine';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/store';
import { tNum } from '../../src/ui/typography';

// Cycle-1 L2 (#10): rating chips swap emoji for Ionicons — same 3 ratings,
// same tap targets/behavior.
const RATINGS = [
  { r: 1 as const, icon: 'sad-outline' as const },
  { r: 2 as const, icon: 'walk' as const },
  { r: 3 as const, icon: 'fitness' as const },
];

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

export default function SubjectsScreen() {
  const topics = useApp(s => s.topics);
  const plan = useApp(s => s.plan);
  const rateTopicAction = useApp(s => s.rateTopic);
  const rateByTopic = useApp(s => s.rateByTopic);
  const [warn, setWarn] = useState<string | null>(null);

  // group topics by subject (emoji doubles as subject id in v1), preserving first-seen order
  const groups = useMemo(() => {
    const m = new Map<string, Topic[]>();
    for (const t of topics) {
      const g = m.get(t.subjectId) ?? [];
      g.push(t);
      m.set(t.subjectId, g);
    }
    return [...m.entries()];
  }, [topics]);

  const rate = (topicId: string, r: 1 | 2 | 3) => {
    setWarn(null);
    // canonical path when the topic is due in today's plan (also logs the revision block)
    const uid = `t_${topicId}`;
    if (plan.some(p => p.uid === uid && p.kind === 'rev')) {
      rateTopicAction(uid, r);
      return;
    }
    if (!rateByTopic(topicId, r)) {
      setWarn(`${topicId}: nothing to move — topic already mastered.`); // no silent no-ops (F21)
    }
  };

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Subjects</Text>
      <Text className="mt-1 text-[13px] text-dim">
        {topics.length} topics · rate confidence to move the mastery ladder
      </Text>

      {topics.length === 0 && (
        <Text className="mt-10 text-center text-sm text-dim">No topics yet — complete onboarding.</Text>
      )}

      {groups.map(([subjectId, gtopics]) => (
        <View key={subjectId}>
          {/* cycle-3 lane A: color-coded subject chip anchors each group header */}
          <View className='mb-2 mt-6 flex-row items-center gap-2'>
            <SubjectAvatar subjectKey={subjectId} />
            <Text className="flex-1 text-[13px] font-extrabold uppercase tracking-wider text-text">
              {subjectId} <Text className="font-normal normal-case text-dim">· {gtopics.length} topics</Text>
            </Text>
          </View>
          {gtopics.map(t => (
            <TopicRow key={t.id} topic={t} onRate={r => rate(t.id, r)} />
          ))}
        </View>
      ))}

      {warn && (
        <View className="mt-4 flex-row items-center gap-1.5 rounded-xl border border-due/40 bg-due/10 p-3">
          <Ionicons name='warning-outline' size={14} color='#F87171' />
          <Text className="flex-1 text-xs" style={{ color: '#F87171' }}>{warn}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function TopicRow({ topic, onRate }: { topic: Topic; onRate: (r: 1 | 2 | 3) => void }) {
  const mastered = topic.box >= 5;
  const due =
    mastered ? { text: 'mastered', color: '#4ADE80' }
    : topic.box === 0 ? { text: 'not started', color: '#8B94A3' }
    : topic.dueIn <= 0 ? { text: 'due now', color: '#F87171' }
    : { text: `due in ${topic.dueIn}d`, color: '#8B94A3' };

  return (
    <View className="mb-3 rounded-3xl border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 font-bold" style={{ color: '#E7EBF2' }}>{topic.name}</Text>
        <Text className="ml-2 text-xs" style={{ color: due.color, ...tNum }}>{due.text}</Text>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        {/* box ladder — filled dots = current box */}
        <View className="flex-row gap-1.5">
          {Array.from({ length: 5 }, (_, i) => {
            const on = i < topic.box;
            return (
              <View
                key={i}
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: on ? (mastered ? '#4ADE80' : '#8B7CF6') : '#232C37' }}
              />
            );
          })}
        </View>

        {!mastered && (
          <View className="flex-row gap-1.5">
            {RATINGS.map(({ r, icon }) => (
              <Pressable
                key={r}
                onPress={() => onRate(r)}
                accessibilityLabel={`Rate ${r}`}
                className="h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-2 active:bg-accent/30"
              >
                <Ionicons name={icon} size={16} color='#E7EBF2' />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
