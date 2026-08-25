/**
 * /settings — dedicated Settings page (c5 F7, lane L3).
 *
 * Sections:
 *  a. PREFERENCES — daily study goal knob (1–12h, wired into planner capacity
 *     via store.dailyHours → engine studyWindowFor) + time format toggle (12/24h,
 *     consumed by src/ui/time.ts fmtClock on Plan/Today renders).
 *  b. STUDY SETUP — read-only summary of current store state (board/class fields
 *     don't exist in the store yet — see Today screen note; navigation to
 *     onboarding?step=board lands later).
 *  c. DATA — reset-all with visible confirm Alert (wipes via store setState +
 *     persist(), mirroring the pre-onboarding initial state).
 *  d. ABOUT — version from app.json via expo-constants.
 */
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { initialStreak } from '@abhyas/engine';
import { useApp, persist } from '../src/store';
import type { TimeFormat } from '../src/persistence';

const ACCENT = '#8B7CF6';
const RED = '#F87171';

export default function SettingsScreen() {
  const router = useRouter();
  const dailyHours = useApp(s => s.dailyHours);
  const setDailyHours = useApp(s => s.setDailyHours);
  const timeFormat = useApp(s => s.timeFormat);
  const setTimeFormat = useApp(s => s.setTimeFormat);
  const topics = useApp(s => s.topics);
  const exams = useApp(s => s.exams);
  const learningStyle = useApp(s => s.learningStyle);
  const classSessions = useApp(s => s.classSessions);

  const subjectCount = new Set(topics.map(t => t.subjectId)).size;

  const confirmReset = () => {
    Alert.alert(
      'Reset all data?',
      'This wipes your subjects, exams, timetable, session history and streak from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: () => {
            // Full in-store wipe (no separate pm-clear path exists) — same shape
            // as the pre-onboarding initial state. persist() writes the empty snapshot.
            useApp.setState({
              topics: [],
              exams: [],
              classSessions: [],
              sessions: [],
              plan: [],
              doneUids: new Set<string>(),
              dayIndex: 0,
              learningStyle: 'average',
              streak: initialStreak(),
              examSeasonDial: 1,
              pendingGuardianInvites: [],
              subjectMeta: {},
            });
            persist();
          },
        },
      ],
    );
  };

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className='h-10 w-10 items-center justify-center rounded-full border border-line bg-surface'
        >
          <Ionicons name='chevron-back' size={20} color='#8B94A3' />
        </Pressable>
        <Text className="text-text text-2xl font-extrabold tracking-tight">Settings</Text>
      </View>

      {/* --- a. PREFERENCES --- */}
      <SectionTitle>PREFERENCES</SectionTitle>
      <Card>
        <Row icon='hourglass-outline' label='Daily study goal'>
          <View className='flex-row items-center gap-3'>
            <Pressable
              accessibilityLabel='Decrease daily study goal'
              onPress={() => setDailyHours(dailyHours - 1)}
              disabled={dailyHours <= 1}
              className='h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2'
            >
              <Text className='text-lg font-extrabold' style={{ color: '#E7EBF2' }}>−</Text>
            </Pressable>
            <Text className='w-12 text-center text-lg font-extrabold tabular-nums' style={{ color: '#C9BFFF' }}>
              {dailyHours}h
            </Text>
            <Pressable
              accessibilityLabel='Increase daily study goal'
              onPress={() => setDailyHours(dailyHours + 1)}
              disabled={dailyHours >= 12}
              className='h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2'
            >
              <Text className='text-lg font-extrabold' style={{ color: '#E7EBF2' }}>+</Text>
            </Pressable>
          </View>
        </Row>
        <Text className='mt-1 text-[11px] text-dim'>1–12h · your plan&apos;s daily capacity follows this</Text>

        <Row icon='time-outline' label='Time format'>
          <View className='flex-row rounded-full border border-line bg-surface-2 p-0.5'>
            {(['12', '24'] as TimeFormat[]).map(f => (
              <Pressable
                key={f}
                accessibilityLabel={`${f}-hour time format`}
                onPress={() => setTimeFormat(f)}
                className={`h-8 w-14 items-center justify-center rounded-full ${
                  timeFormat === f ? 'bg-accent/30 border border-accent' : ''
                }`}
              >
                <Text
                  className='text-xs font-extrabold'
                  style={{ color: timeFormat === f ? ACCENT : '#8B94A3' }}
                >
                  {f}h
                </Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Card>

      {/* --- b. STUDY SETUP (read-only summary) --- */}
      <SectionTitle>STUDY SETUP</SectionTitle>
      <Card>
        <SummaryRow label='Board & class' value='Set during setup' />
        <SummaryRow label='Learning style' value={learningStyle} />
        <SummaryRow label='Subjects' value={subjectCount === 0 ? '—' : `${subjectCount}`} />
        <SummaryRow label='Exams' value={exams.length === 0 ? '—' : `${exams.length}`} />
        <SummaryRow
          label='Class periods'
          value={classSessions.length === 0 ? '—' : `${classSessions.length}`}
        />
      </Card>

      {/* --- c. DATA --- */}
      <SectionTitle>DATA</SectionTitle>
      <Card>
        <Pressable
          accessibilityLabel='Reset all data'
          onPress={confirmReset}
          className='flex-row items-center justify-center gap-1.5 rounded-2xl border py-3 active:bg-accent/30'
          style={{ borderColor: `${RED}55` }}
        >
          <Ionicons name='trash-outline' size={16} color={RED} />
          <Text className='text-sm font-extrabold' style={{ color: RED }}>
            Reset all data
          </Text>
        </Pressable>
        <Text className='mt-2 text-[11px] text-dim'>
          Wipes everything on this device and returns to first-run onboarding.
        </Text>
      </Card>

      {/* --- d. ABOUT --- */}
      <SectionTitle>ABOUT</SectionTitle>
      <Card>
        <SummaryRow label='Abhyas (StudySync)' value={`v${Constants.expoConfig?.version ?? '?'}`} />
      </Card>

      <View className='mb-10' />
    </ScrollView>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className='mb-2 mt-7 text-[13px] font-extrabold uppercase tracking-wider text-text'>
      {children}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className='rounded-3xl border border-line bg-surface p-4'>{children}</View>
  );
}

function Row({ icon, label, children }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className='mt-1 flex-row items-center justify-between'>
      <View className='flex-row items-center gap-1.5'>
        <Ionicons name={icon} size={16} color='#C9BFFF' />
        <Text className='font-bold' style={{ color: '#E7EBF2' }}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className='mt-2 flex-row items-center justify-between'>
      <Text className='text-sm text-dim'>{label}</Text>
      <Text className='text-sm font-bold capitalize' style={{ color: '#E7EBF2' }}>{value}</Text>
    </View>
  );
}
