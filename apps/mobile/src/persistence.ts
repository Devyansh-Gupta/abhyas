/**
 * Persistence seam for the app store (#8 prep).
 * The store stays in-memory by default; a host (app entry, tests, future SQLite
 * repo) opts in via `configurePersistence(adapter)`. No storage backend lives here.
 */
import { type Topic, type Exam, type LearningStyle, type StreakState } from '@abhyas/engine';
import type { SessionLogEntry } from './store';

/**
 * Serializable projection of the persisted state fields.
 * `doneUids` is stored as string[] (Set is not serializable); `plan` is excluded —
 * it is rebuilt from topics/exams/dayIndex on hydrate+advanceDay.
 */
export interface Snapshot {
  topics: Topic[];
  exams: Exam[];
  sessions: SessionLogEntry[];
  doneUids: string[];
  dayIndex: number;
  learningStyle: LearningStyle;
  streak: StreakState;
}

export interface PersistenceAdapter {
  /** Return the last saved snapshot, or null when nothing has been persisted yet. */
  load(): Promise<Snapshot | null>;
  /** Persist a snapshot. Fire-and-forget from the store's perspective. */
  save(snapshot: Snapshot): void;
}
