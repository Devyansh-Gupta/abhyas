import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useApp, configurePersistence, hydrate } from '../src/store';
import type { PersistenceAdapter, Snapshot } from '../src/persistence';
import { decodeGuardianCode } from '@abhyas/engine';

/** Fake in-memory adapter recording every save. */
function makeAdapter(initial: Snapshot | null = null) {
  const adapter: PersistenceAdapter & { saves: Snapshot[]; snap: Snapshot | null } = {
    saves: [],
    snap: initial,
    async load() {
      return adapter.snap;
    },
    save(snapshot) {
      adapter.saves.push(snapshot);
      adapter.snap = snapshot;
    },
  };
  return adapter;
}

const fresh = () => {
  useApp.setState({
    topics: [],
    exams: [],
    sessions: [],
    plan: [],
    doneUids: new Set(),
    dayIndex: 4,
    learningStyle: 'average',
    streak: { current: 0, longest: 0, missed: 0, countedToday: false },
    pendingGuardianInvites: [],
  });
};

afterEach(() => {
  configurePersistence(null); // never leak an adapter into other tests
});

describe('parent-link store wiring (P2)', () => {
  beforeEach(fresh);

  it('createGuardianInvite mints a verifiable code from live dayIndex', () => {
    const inv = useApp.getState().createGuardianInvite();
    expect(inv.payload.issuedDay).toBe(4);
    expect(useApp.getState().pendingGuardianInvites).toHaveLength(1);
    // the minted code opens the /guardian route as valid today
    expect(decodeGuardianCode(inv.code, { todayDay: 4 })).toMatchObject({ ok: true });
  });

  it('every invite action routes through persist()', () => {
    const spy = makeAdapter();
    configurePersistence(spy);

    useApp.getState().createGuardianInvite();
    useApp.getState().createGuardianInvite();

    expect(spy.saves.length).toBe(2); // one save per action, like every other store action
    for (const snap of spy.saves) expect(snap.pendingGuardianInvites).toHaveLength(spy.saves.indexOf(snap) + 1);
    // nonces keep same-day invites distinct
    const [a, b] = useApp.getState().pendingGuardianInvites;
    expect(a.id).not.toBe(b.id);
  });

  it('hydrate restores pending invites; pre-P2 snapshots default to []', async () => {
    const withInvites = makeAdapter();
    configurePersistence(withInvites);
    useApp.getState().createGuardianInvite();
    const saved = withInvites.snap!;

    // fresh boot against that snapshot
    fresh();
    configurePersistence(makeAdapter(saved));
    await expect(hydrate()).resolves.toBe(true);
    expect(useApp.getState().pendingGuardianInvites).toEqual(saved.pendingGuardianInvites);

    // legacy snapshot without the field → empty list, no crash
    const legacy: Snapshot = { ...saved, pendingGuardianInvites: undefined };
    fresh();
    configurePersistence(makeAdapter(legacy));
    await expect(hydrate()).resolves.toBe(true);
    expect(useApp.getState().pendingGuardianInvites).toEqual([]);
  });

  it('an expired invite still persists but fails verification at the guardian route', () => {
    useApp.setState({ dayIndex: 999 });
    const inv = useApp.getState().createGuardianInvite();
    const r = decodeGuardianCode(inv.code, { todayDay: 999 + 31 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('expired');
  });
});
