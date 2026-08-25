/**
 * P3 OCR import (issue T3, phase 2) — pick → reading → review → done.
 *
 * UI is staged and every failure mode is VISIBLE (docs/p3-ocr-research.md):
 *  - OCR provider missing/broken  → typed OcrUnavailableError card + retry
 *  - empty extraction             → "no readable text" card + retry
 *  - zero parsed subjects         → review stage with parser warnings + disabled footer
 *  - all-zero selection           → footer disabled + hint line
 *
 * Store path mirrors onboarding's custom-subject finish: setState() merges the
 * new topics into `topics`, upserts `subjectMeta` ({name}), re-derives the
 * plan with buildDayPlan(), then calls persist() explicitly (setState bypasses
 * the store's persist-on-action wrappers).
 */
import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { parseSyllabusText, buildDayPlan, type Topic } from '@abhyas/engine';
import * as ImagePicker from 'expo-image-picker';
import { useApp, persist } from '../src/store';
import { extractText, OcrUnavailableError } from '../src/lib/ocr';
import {
  draftFromParsed, initialSelection, toggleSubject, toggleTopic,
  countSelected, isSubjectFullySelected,
  type ParsedSubjectDraft, type SelectionState,
} from '../src/lib/import-selection';

type Stage = 'pick' | 'reading' | 'review' | 'done';

/** readable imported ids: 'Mathematics' → subjectId 'imported-mathematics' */
const subjectIdFor = (key: string): string => `imported-${key}`;

export default function ImportScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('pick');
  const [permNote, setPermNote] = useState<string | null>(null);
  const [ocrUnavailable, setOcrUnavailable] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);
  const [emptyExtraction, setEmptyExtraction] = useState(false);

  const [draft, setDraft] = useState<ParsedSubjectDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sel, setSel] = useState<SelectionState>({ subjects: {}, topics: {} });

  const [doneCounts, setDoneCounts] = useState<{ subjects: number; topics: number } | null>(null);

  const resetErrors = () => {
    setPermNote(null);
    setOcrUnavailable(null);
    setGenericError(null);
    setEmptyExtraction(false);
  };

  /** shared tail of the flow: OCR lines → parse → review draft */
  const runOcr = useCallback(async (uri: string) => {
    resetErrors();
    setStage('reading');
    try {
      const lines = await extractText(uri);
      if (!lines.some(l => l.trim())) {
        // visible state, not a silent no-op: back to pick with an explainer
        setEmptyExtraction(true);
        setStage('pick');
        return;
      }
      const parsed = parseSyllabusText(lines);
      const d = draftFromParsed(parsed);
      setDraft(d);
      setWarnings(parsed.warnings);
      setSel(initialSelection(d));
      setStage('review');
    } catch (err) {
      setStage('pick');
      if (err instanceof OcrUnavailableError) {
        setOcrUnavailable(err.message);
      } else {
        setGenericError(err instanceof Error ? err.message : 'Something went wrong while reading the image.');
      }
    }
  }, []);

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    resetErrors();
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setPermNote('Camera permission denied — enable it in system settings to photograph your syllabus.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (res.canceled || !res.assets[0]) return;
      void runOcr(res.assets[0].uri);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPermNote('Photo library permission denied — enable it in system settings to pick your syllabus image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (res.canceled || !res.assets[0]) return;
      void runOcr(res.assets[0].uri);
    }
  }, [runOcr]);

  const counts = countSelected(draft, sel);

  const doImport = () => {
    if (counts.subjects === 0) return; // footer is disabled; belt-and-braces guard
    const st = useApp.getState();

    // merge selected subjects/topics in, mirroring onboarding's custom-subject
    // shape (bare topics, box 0, dueIn -1) with readable imported ids
    const meta = { ...st.subjectMeta };
    const newTopics: Topic[] = [];
    const usedIds = new Set(st.topics.map(t => t.id));
    for (const sub of draft) {
      if (!sel.subjects[sub.key]) continue;
      const picked = sub.topics.filter(t => sel.topics[t.key]);
      if (picked.length === 0) continue;
      const sid = subjectIdFor(sub.key);
      meta[sid] = { name: sub.name };
      picked.forEach((t, idx) => {
        let base = `${sid}-${t.key.split('/')[1]}`;
        let id = base;
        let n = 2;
        while (usedIds.has(id)) id = `${base}-${n++}`;
        usedIds.add(id);
        newTopics.push({
          id,
          subjectId: sid as Topic['subjectId'],
          name: t.label,
          box: 0,
          dueIn: -1,
          weight: 5,
          coverage: 'unstarted',
          backlog: false,
        });
        void idx;
      });
    }

    const merged = [...st.topics, ...newTopics];
    useApp.setState({
      topics: merged,
      subjectMeta: meta,
      plan: buildDayPlan(merged as Topic[], st.exams, 0),
    });
    // setState() bypasses the store's action wrappers → persist explicitly
    // (same requirement as onboarding's finish path)
    persist();

    setDoneCounts(counts);
    setStage('done');
    setTimeout(() => router.back(), 1400);
  };

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Import syllabus</Text>
      <Text className="mt-1 text-[13px] text-dim">Photograph a syllabus or datesheet — tick what you want before anything is added.</Text>

      {/* ---------- STAGE: pick ---------- */}
      {stage === 'pick' && (
        <>
          <View className='mt-6 items-center justify-center rounded-3xl border-2 border-dashed border-line bg-surface p-8'>
            <Ionicons name='document-text-outline' size={48} color='#8B7CF6' />
            <Text className='mt-3 text-center text-sm font-bold text-text'>Take a photo of your syllabus</Text>
            <Text className='mt-1 text-center text-xs text-dim'>Printed lists work best — one subject per line.</Text>
          </View>

          {permNote && (
            <Notice tone='amber' icon='alert-circle-outline' text={permNote} />
          )}
          {ocrUnavailable && (
            <Notice
              tone='red'
              icon='scan-outline'
              text='Text recognition unavailable on this device/build'
              detail={ocrUnavailable}
            />
          )}
          {genericError && (
            <Notice tone='red' icon='alert-circle-outline' text='Could not read that image' detail={genericError} />
          )}
          {emptyExtraction && (
            <Notice
              tone='amber'
              icon='text-outline'
              text='No readable text found'
              detail='The photo didn\u2019t contain detectable text — try better lighting or hold the camera steadier.'
            />
          )}

          <View className='mt-6 gap-2'>
            {(permNote || ocrUnavailable || genericError || emptyExtraction) && (
              <Pressable
                onPress={() => resetErrors()}
                accessibilityLabel='Dismiss errors'
                className='items-center rounded-2xl bg-surface py-4'
              >
                <Text className='font-bold text-dim'>Dismiss</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => void pickImage('camera')}
              accessibilityLabel='Take a photo with the camera'
              className='flex-row items-center justify-center gap-2 rounded-2xl bg-accent py-4'
            >
              <Ionicons name='camera-outline' size={18} color='#fff' />
              <Text className='font-extrabold text-white'>Camera</Text>
            </Pressable>
            <Pressable
              onPress={() => void pickImage('library')}
              accessibilityLabel='Pick a photo from the library'
              className='flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-4'
            >
              <Ionicons name='images-outline' size={18} color='#E7EBF2' />
              <Text className='font-extrabold text-text'>Photo library</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ---------- STAGE: reading ---------- */}
      {stage === 'reading' && (
        <View className='mt-16 items-center'>
          <ActivityIndicator size='large' color='#8B7CF6' />
          <Text className='mt-4 text-sm font-bold text-text'>Reading image…</Text>
          <Text className='mt-1 text-xs text-dim'>On-device text recognition — nothing leaves your phone.</Text>
        </View>
      )}

      {/* ---------- STAGE: review ---------- */}
      {stage === 'review' && (
        <>
          {/* parser warnings — amber note cards, never silent */}
          {warnings.map((w, i) => (
            <Notice key={i} tone='amber' icon='warning-outline' text={w} />
          ))}

          {draft.length === 0 && (
            <View className='mt-6 rounded-2xl border border-due/40 bg-due/10 p-4'>
              <Text className='font-bold' style={{ color: '#F87171' }}>No subjects detected</Text>
              <Text className='mt-1 text-xs text-dim'>
                We couldn&apos;t find subject headers. Go back and retake the photo — ALL-CAPS headings or &quot;Subject:&quot; lines parse best.
              </Text>
            </View>
          )}

          {draft.map(sub => {
            const headerOn = !!sel.subjects[sub.key];
            const full = isSubjectFullySelected(draft, sel, sub.key);
            const pickedCount = sub.topics.filter(t => !!sel.topics[t.key]).length;
            return (
              <View key={sub.key} className='mb-4 mt-4 rounded-2xl border border-line bg-surface p-3'>
                <Pressable
                  onPress={() => setSel(toggleSubject(draft, sel, sub.key, !headerOn))}
                  accessibilityLabel={`${headerOn ? 'Deselect' : 'Select'} subject ${sub.name}`}
                  className='flex-row items-center'
                >
                  <TickBox on={full} />
                  <Text className='ml-3 flex-1 text-[13px] font-extrabold uppercase tracking-wider text-text'>{sub.name}</Text>
                  <Text className='text-xs text-dim'>{pickedCount}/{sub.topics.length} topics</Text>
                </Pressable>
                {sub.topics.map(t => {
                  const on = !!sel.topics[t.key];
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => setSel(toggleTopic(sel, t.key, !on))}
                      accessibilityLabel={`${on ? 'Deselect' : 'Select'} topic ${t.label}`}
                      className={`mt-2 flex-row items-center rounded-xl px-3 py-2.5 ${on ? 'bg-accent/10' : 'bg-surface-2 opacity-60'}`}
                    >
                      <TickBox small on={on} />
                      <Text className='ml-3 flex-1 text-sm text-text' style={{ textDecorationLine: on ? 'none' : 'line-through' }}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {sub.topics.length === 0 && (
                  <Text className='mt-2 px-3 text-xs italic text-dim'>No topics listed under this heading</Text>
                )}
              </View>
            );
          })}

          <View className='mb-10 mt-2'>
            {counts.subjects === 0 && draft.length > 0 && (
              <Text className='mb-2 text-center text-xs text-[#FBBF24]'>
                Nothing selected — tick at least one topic to import.
              </Text>
            )}
            <Pressable
              onPress={doImport}
              disabled={counts.subjects === 0}
              accessibilityLabel={`Import ${counts.subjects} subjects and ${counts.topics} topics`}
              className={`rounded-2xl py-4 ${counts.subjects > 0 ? 'bg-accent' : 'bg-surface-2'}`}
            >
              <Text className={`text-center font-extrabold ${counts.subjects > 0 ? 'text-white' : 'text-dim'}`}>
                Import {counts.subjects} subject{counts.subjects === 1 ? '' : 's'} · {counts.topics} topic{counts.topics === 1 ? '' : 's'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ---------- STAGE: done (visible confirmation, then back) ---------- */}
      {stage === 'done' && doneCounts && (
        <View className='mt-10 items-center rounded-3xl border p-6' style={{ borderColor: '#4ADE8066', backgroundColor: '#4ADE801A' }}>
          <Ionicons name='checkmark-circle' size={56} color='#4ADE80' />
          <Text className='mt-3 text-base font-extrabold text-text'>Imported!</Text>
          <Text className='mt-1 text-center text-sm text-dim'>
            {doneCounts.subjects} subject{doneCounts.subjects === 1 ? '' : 's'} · {doneCounts.topics} topic{doneCounts.topics === 1 ? '' : 's'} added — today&apos;s plan was rebuilt.
          </Text>
        </View>
      )}

      <View className='h-12' />
    </ScrollView>
  );
}

/* atoms */

function TickBox({ on, small }: { on: boolean; small?: boolean }) {
  const size = small ? 20 : 24;
  return (
    <View
      className={`items-center justify-center rounded-lg border ${on ? 'border-accent bg-accent' : 'border-line bg-surface-2'}`}
      style={{ width: size, height: size }}
    >
      {on && <Ionicons name='checkmark' size={small ? 13 : 16} color='#fff' />}
    </View>
  );
}

function Notice({ tone, icon, text, detail }: {
  tone: 'amber' | 'red';
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  detail?: string;
}) {
  const color = tone === 'red' ? '#F87171' : '#FBBF24';
  return (
    <View className='mt-4 flex-row rounded-2xl border p-3' style={{ borderColor: `${color}66`, backgroundColor: `${color}1A` }}>
      <Ionicons name={icon} size={16} color={color} />
      <View className='ml-2 flex-1'>
        <Text className='text-xs font-bold' style={{ color }}>{text}</Text>
        {!!detail && <Text className='mt-0.5 text-xs text-dim'>{detail}</Text>}
      </View>
    </View>
  );
}
