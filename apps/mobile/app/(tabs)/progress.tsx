import { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  masteryBySubject,
  applyExamSeason,
  dateForDayIndex,
  clampCapacity,
  CAPACITY_MIN,
  CAPACITY_MAX,
} from '@abhyas/engine';
import { useApp } from '../../src/store';
import { useAuth } from '../../src/lib/auth';
import { syncNow } from '../../src/repo/syncTransport';
import { useState } from 'react';

export default function ProgressScreen() {
  const router = useRouter();
  const sessions = useApp(s => s.sessions);
  const streak = useApp(s => s.streak);
  const topics = useApp(s => s.topics);
  const dayIndex = useApp(s => s.dayIndex);
  // Exam Season capacity dial (#9) — minimal settings surface
  const exams = useApp(s => s.exams);
  const dial = useApp(s => s.examSeasonDial);
  const setDial = useApp(s => s.setExamSeasonDial);

  // live derive from store — bars move when rating moves boxes (#7 acceptance)
  const mastery = useMemo(() => masteryBySubject(topics), [topics]);
  const season = useMemo(
    () => applyExamSeason(topics, exams, dateForDayIndex(dayIndex), dial),
    [topics, exams, dayIndex, dial],
  );

  const totalMin = sessions.reduce((a, s) => a + s.min, 0);
  const todayMin = sessions.filter(s => s.day === dayIndex).reduce((a, s) => a + s.min, 0);
  const daysStudied = new Set(sessions.filter(s => s.min > 0).map(s => s.day)).size;

  return (
    <ScrollView className="flex-1 bg-bg px-5 pt-14">
      <Text className="text-text text-2xl font-extrabold tracking-tight">Progress</Text>
      <Text className="mt-1 text-[13px] text-dim">live from your session log &amp; mastery ladder</Text>

      {/* streak + focus stats */}
      <View className="mt-6 flex-row gap-3">
        <Stat emoji='🔥' value={`${streak.current}`} label='day streak' />
        <Stat emoji='🏆' value={`${streak.longest}`} label='longest' />
      </View>
      <View className="mt-3 flex-row gap-3">
        <Stat emoji='⏱️' value={`${todayMin}m`} label='focused today' />
        <Stat emoji='📚' value={`${Math.round(totalMin / 60)}h ${totalMin % 60}m`} label='total focus' />
        <Stat emoji='📆' value={`${daysStudied}`} label='days studied' />
      </View>

      {/* Exam Season capacity dial (#9) */}
      <View className='mt-3 rounded-3xl border border-line bg-surface p-4'>
        <View className='flex-row items-center justify-between'>
          <Text className='font-extrabold' style={{ color: '#E7EBF2' }}>🎯 Exam Season</Text>
          <Text className='text-xs font-bold text-dim'>
            {season.active
              ? season.gapDay ? 'gap day · boosted' : 'active'
              : 'off-season'}
          </Text>
        </View>
        <View className='mt-3 flex-row items-center justify-between'>
          <Pressable
            accessibilityLabel='Decrease exam-season capacity'
            className='h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2'
            onPress={() => setDial(dial - 0.25)}
            disabled={dial <= CAPACITY_MIN}
          >
            <Text className='text-lg font-extrabold' style={{ color: '#E7EBF2' }}>−</Text>
          </Pressable>
          <View className='items-center'>
            <Text className='text-xl font-extrabold tabular-nums' style={{ color: '#C9BFFF' }}>
              {Math.round(clampCapacity(dial) * 100)}%
            </Text>
            <Text className='text-[11px] text-dim'>
              today&apos;s target ≈ {season.capacityMinutes}m
            </Text>
          </View>
          <Pressable
            accessibilityLabel='Increase exam-season capacity'
            className='h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2'
            onPress={() => setDial(dial + 0.25)}
            disabled={dial >= CAPACITY_MAX}
          >
            <Text className='text-lg font-extrabold' style={{ color: '#E7EBF2' }}>+</Text>
          </Pressable>
        </View>
        {season.active && (
          <Text className='mt-2 text-[11px] text-dim'>
            focus: {season.focusSubjects.join(' ') || '—'} · other subjects tapered
          </Text>
        )}
      </View>

      {/* P2 parent link: mint a shareable read-only invite */}
      <ParentLinkCard />

      {/* P2 account + cloud sync entry point */}
      <AccountSyncCard onOpenAuth={() => router.push('/auth')} />

      {/* per-subject mastery */}
      <Text className="mb-3 mt-7 text-[13px] font-extrabold uppercase tracking-wider text-text">
        Mastery by subject <Text className="font-normal normal-case text-dim">· avg box ÷ 5</Text>
      </Text>
      {mastery.length === 0 && (
        <Text className="mt-4 text-center text-sm text-dim">
          No subjects yet — complete onboarding to seed your syllabus.
        </Text>
      )}
      {mastery.map(m => (
        <View key={m.subjectId} className="mb-4 rounded-3xl border border-line bg-surface p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold" style={{ color: '#E7EBF2' }}>
              {m.subjectId} <Text className="text-xs font-normal text-dim">· {m.topics} topics</Text>
            </Text>
            <Text className="text-xs font-extrabold" style={{ color: m.pct >= 80 ? '#4ADE80' : '#C9BFFF' }}>
              {m.pct}%
            </Text>
          </View>
          <View className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, m.pct))}%`, backgroundColor: m.pct >= 80 ? '#4ADE80' : '#8B7CF6' }}
            />
          </View>
        </View>
      ))}

      {sessions.length === 0 && (
        <Text className="mt-2 text-center text-xs text-dim">
          No focus logged yet — run the timer in Focus and it lands here.
        </Text>
      )}
    </ScrollView>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-line bg-surface py-3">
      <Text className="text-lg">{emoji}</Text>
      <Text className="mt-0.5 font-extrabold tabular-nums" style={{ color: '#E7EBF2' }}>{value}</Text>
      <Text className="text-[11px] text-dim">{label}</Text>
    </View>
  );
}

/** P2 parent link — student side: generate a signed invite a parent can open. */
function ParentLinkCard() {
  const invites = useApp(s => s.pendingGuardianInvites);
  const mint = useApp(s => s.createGuardianInvite);
  const latest = invites.length > 0 ? invites[invites.length - 1] : null;

  return (
    <View className="mt-3 rounded-3xl border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold" style={{ color: '#E7EBF2' }}>👨‍👩‍👧 Parent link</Text>
        {latest && (
          <Text className="text-xs font-bold text-dim">valid thru day {latest.expiresDay}</Text>
        )}
      </View>

      {latest ? (
        <>
          <Text className="mt-1 text-[11px] text-dim">
            Share this code — it opens your read-only Parent view:
          </Text>
          <Text
            selectable
            numberOfLines={2}
            className="mt-2 rounded-xl border border-line bg-surface-2 p-3 font-mono text-[11px]"
            style={{ color: '#C9BFFF' }}
          >
            {latest.deepLink}
          </Text>
          {invites.length > 1 && (
            <Text className="mt-2 text-[11px] text-dim">{invites.length} invites generated.</Text>
          )}
        </>
      ) : (
        <Text className="mt-1 text-[11px] text-dim">
          Let a parent follow your streak, focus and mastery — read-only.
        </Text>
      )}

      <Pressable
        accessibilityLabel="Generate parent invite"
        className="mt-3 items-center rounded-2xl border border-line bg-surface-2 py-3 active:bg-accent/30"
        onPress={() => mint()}
      >
        <Text className="text-sm font-extrabold" style={{ color: '#C9BFFF' }}>
          {latest ? 'Generate new invite' : 'Generate invite code'}
        </Text>
      </Pressable>
    </View>
  );
}

/** P2 account + cloud sync — sign-in entry point and manual "Sync now". */
function AccountSyncCard({ onOpenAuth }: { onOpenAuth: () => void }) {
  const userId = useAuth(s => s.userId);
  const email = useAuth(s => s.email);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const runSync = async () => {
    setSyncNote('Syncing…');
    const r = await syncNow();
    if (r.skipped) {
      // Visible reason — offline-only mode is a state, not a failure to hide.
      setSyncNote(
        r.reason === 'not-signed-in'
          ? 'Sign in first to sync.'
          : `Sync unavailable: ${r.reason}`,
      );
    } else if (!r.ok) {
      setSyncNote(`Sync failed: ${r.errors.join(' | ')}`);
    } else {
      setSyncNote(`Synced · ↑${r.pushed} ↓${r.pulled} ops`);
    }
  };

  return (
    <View className="mt-3 rounded-3xl border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-extrabold" style={{ color: '#E7EBF2' }}>☁️ Account</Text>
        {userId && <Text className="text-xs font-bold text-dim">{email ?? 'signed in'}</Text>}
      </View>
      {!userId && (
        <Text className="mt-1 text-[11px] text-dim">
          Sign in to keep your plan in sync across devices — the app stays fully usable offline.
        </Text>
      )}
      {syncNote && (
        <Text accessibilityLabel='sync status' className='mt-2 text-[11px] text-dim'>
          {syncNote}
        </Text>
      )}
      <View className='mt-3 flex-row gap-3'>
        <Pressable
          accessibilityLabel={userId ? 'Account settings' : 'Sign in'}
          className='flex-1 items-center rounded-2xl border border-line bg-surface-2 py-3 active:bg-accent/30'
          onPress={onOpenAuth}
        >
          <Text className='text-sm font-extrabold' style={{ color: '#C9BFFF' }}>
            {userId ? 'Manage account' : 'Sign in'}
          </Text>
        </Pressable>
        {userId && (
          <Pressable
            accessibilityLabel='Sync now'
            className='flex-1 items-center rounded-2xl border border-line bg-surface-2 py-3 active:bg-accent/30'
            onPress={() => void runSync()}
          >
            <Text className='text-sm font-extrabold' style={{ color: '#C9BFFF' }}>
              Sync now
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
