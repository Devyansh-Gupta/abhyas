/**
 * Cycle-5 L4 — /exam-import: photograph a datesheet → tickable exam rows →
 * store.addExam per ticked exam → confirmation → back.
 *
 * Structure mirrors app/import.tsx (pick → reading → review → done) with the
 * same visible-failure contract: OcrUnavailableError card, empty extraction,
 * parser warnings as amber notices, disabled footer when nothing is ticked.
 *
 * Store path uses the real addExam action (persists itself), then rebuilds
 * the plan explicitly since setState-free actions don't re-derive it.
 */
import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { parseExamTimetable, buildDayPlan, type Exam } from '@abhyas/engine';
import * as ImagePicker from 'expo-image-picker';
import { useApp, persist } from '../src/store';
import { extractText, OcrUnavailableError } from '../src/lib/ocr';
import {
  rowsFromParsed, initialSelection, toggleExam, countSelected,
  type ExamDraftRow, type ExamSelection,
} from '../src/lib/exam-import-selection';

type Stage = 'pick' | 'reading' | 'review' | 'done';

export default function ExamImportScreen() {
  const router = useRouter();
  const { return: returnTo } = useLocalSearchParams<{ return?: string }>();

  const [stage, setStage] = useState<Stage>('pick');
  const [permNote, setPermNote] = useState<string | null>(null);
  const [ocrUnavailable, setOcrUnavailable] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);
  const [emptyExtraction, setEmptyExtraction] = useState(false);

  const [rows, setRows] = useState<ExamDraftRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sel, setSel] = useState<ExamSelection>({});
  const [doneCount, setDoneCount] = useState<number | null>(null);

  const resetErrors = () => {
    setPermNote(null);
    setOcrUnavailable(null);
    setGenericError(null);
    setEmptyExtraction(false);
  };

  const runOcr = useCallback(async (uri: string) => {
    resetErrors();
    setStage('reading');
    try {
      const lines = await extractText(uri);
      if (!lines.some(l => l.trim())) {
        setEmptyExtraction(true);
        setStage('pick');
        return;
      }
      const parsed = parseExamTimetable(lines);
      const r = rowsFromParsed(parsed.exams);
      setRows(r);
      setWarnings(parsed.warnings);
      setSel(initialSelection(r));
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
        setPermNote('Camera permission denied — enable it in system settings to photograph your datesheet.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (res.canceled || !res.assets[0]) return;
      void runOcr(res.assets[0].uri);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPermNote('Photo library permission denied — enable it in system settings to pick your datesheet image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (res.canceled || !res.assets[0]) return;
      void runOcr(res.assets[0].uri);
    }
  }, [runOcr]);

  const counts = countSelected(rows, sel);

  const doImport = () => {
    if (counts === 0) return; // footer is disabled; belt-and-braces guard
    const today = new Date().toISOString().slice(0, 10);
    let n = 0;
    for (const row of rows) {
      if (!sel[row.key]) continue;
      const date = row.date ?? today;
      // window == exact paper date (datesheet confirmed by definition here)
      const exam: Exam = {
        id: `exam_${Date.now().toString(36)}_${n++}`,
        name: row.name,
        kind: 'school',
        windowStart: date,
        windowEnd: date,
        subjectIds: [],
        datesheetConfirmed: true,
      };
      useApp.getState().addExam(exam); // persists itself
    }
    // re-derive today's plan against the enlarged exam set
    const st = useApp.getState();
    useApp.setState({ plan: buildDayPlan(st.topics, st.exams, 0) });
    persist();

    setDoneCount(counts);
    setStage('done');
    setTimeout(() => router.back(), 1400);
  };

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Import exams</Text>
      <Text className="mt-1 text-[13px] text-dim">
        Photograph a datesheet{returnTo === 'onboarding' ? ' — we\u2019ll attach these to your setup.' : ''} Tick what you want before anything is added.
      </Text>

      {/* ---------- STAGE: pick ---------- */}
      {stage === 'pick' && (
        <>
          <View className='mt-6 items-center justify-center rounded-3xl border-2 border-dashed border-line bg-surface p-8'>
            <Ionicons name='calendar-outline' size={48} color='#8B7CF6' />
            <Text className='mt-3 text-center text-sm font-bold text-text'>Take a photo of the datesheet</Text>
            <Text className='mt-1 text-center text-xs text-dim'>Date + subject rows work best — one paper per line.</Text>
          </View>

          {permNote && <Notice tone='amber' icon='alert-circle-outline' text={permNote} />}
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
          {warnings.map((w, i) => (
            <Notice key={i} tone='amber' icon='warning-outline' text={w} />
          ))}

          {rows.length === 0 && (
            <View className='mt-6 rounded-2xl border border-due/40 bg-due/10 p-4'>
              <Text className='font-bold' style={{ color: '#F87171' }}>No dated exam rows detected</Text>
              <Text className='mt-1 text-xs text-dim'>
                We couldn&apos;t find date + subject lines. Retake the photo — rows like &quot;03.09.2026 Mathematics FN&quot; parse best.
              </Text>
            </View>
          )}

          {rows.map(row => {
            const on = !!sel[row.key];
            return (
              <Pressable
                key={row.key}
                onPress={() => setSel(toggleExam(sel, row.key, !on))}
                accessibilityLabel={`${on ? 'Deselect' : 'Select'} exam ${row.name}`}
                className={`mb-2 flex-row items-center rounded-2xl border p-3.5 ${on ? 'border-accent bg-accent/10' : 'border-line bg-surface opacity-60'}`}
              >
                <TickBox on={on} />
                <View className='ml-3 flex-1'>
                  <Text className='text-sm font-bold text-text' style={{ textDecorationLine: on ? 'none' : 'line-through' }}>
                    {row.name}
                  </Text>
                  {!!(row.date || row.session) && (
                    <Text className='mt-0.5 text-xs text-dim'>
                      {[row.date, row.session].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}

          <View className='mb-10 mt-2'>
            {counts === 0 && rows.length > 0 && (
              <Text className='mb-2 text-center text-xs text-[#FBBF24]'>
                Nothing selected — tick at least one exam to import.
              </Text>
            )}
            <Pressable
              onPress={doImport}
              disabled={counts === 0}
              accessibilityLabel={`Import ${counts} exams`}
              className={`rounded-2xl py-4 ${counts > 0 ? 'bg-accent' : 'bg-surface-2'}`}
            >
              <Text className={`text-center font-extrabold ${counts > 0 ? 'text-white' : 'text-dim'}`}>
                Import {counts} exam{counts === 1 ? '' : 's'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ---------- STAGE: done (visible confirmation, then back) ---------- */}
      {stage === 'done' && doneCount !== null && (
        <View className='mt-10 items-center rounded-3xl border p-6' style={{ borderColor: '#4ADE8066', backgroundColor: '#4ADE801A' }}>
          <Ionicons name='checkmark-circle' size={56} color='#4ADE80' />
          <Text className='mt-3 text-base font-extrabold text-text'>Imported!</Text>
          <Text className='mt-1 text-center text-sm text-dim'>
            {doneCount} exam{doneCount === 1 ? '' : 's'} added — your plan accounts for them.
          </Text>
        </View>
      )}

      <View className='h-12' />
    </ScrollView>
  );
}

/* atoms (mirrors import.tsx) */

function TickBox({ on }: { on: boolean }) {
  return (
    <View
      className={`items-center justify-center rounded-lg border ${on ? 'border-accent bg-accent' : 'border-line bg-surface-2'}`}
      style={{ width: 24, height: 24 }}
    >
      {on && <Ionicons name='checkmark' size={16} color='#fff' />}
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
