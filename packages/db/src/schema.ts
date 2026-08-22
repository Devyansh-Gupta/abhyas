/**
 * Abhyas schema (PRD §10, updated 2026-08-22 with onboarding-v2 fields).
 * One schema definition, two runtimes:
 *   - device: expo-sqlite driver (local-first source of truth)
 *   - cloud:  postgres driver (Supabase) for sync + parent views
 */
import { sqliteTable as table, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = table('users', {
  id: text('id').primaryKey(),
  role: text('role', { enum: ['student', 'parent'] }).notNull(),
  name: text('name').notNull(),
  classBand: text('class_band'), // e.g. '9-12' | 'ug-pg'
  board: text('board'),
  createdAt: integer('created_at').notNull(),
});

/** Student ⇄ parent link; read-only grant. Pausing is visible to the parent. */
export const guardianLinks = table('guardian_links', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  parentId: text('parent_id'),
  status: text('status', { enum: ['invited', 'active', 'paused'] }).notNull(),
  invitedCode: text('invited_code'),
  consentedAt: integer('consented_at'), // nullable — DPDP flow deferred
});

export const subjects = table('subjects', {
  /** emoji doubles as stable id in v1 (prototype parity) */
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  examWeight: real('exam_weight').default(1),
  targetMarks: integer('target_marks'),
  kind: text('kind', { enum: ['core', 'elective', 'additional'] }).notNull().default('core'),
  origin: text('origin', { enum: ['preset', 'custom', 'import', 'community'] }).notNull().default('preset'),
  presetVersion: text('preset_version'),
});

export const topics = table('topics', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  subjectId: text('subject_id').notNull(),
  name: text('name').notNull(),
  weight: real('weight').notNull().default(5),
  box: integer('box').notNull().default(0),
  dueIn: integer('due_in').notNull().default(-1),
  coverage: text('coverage', { enum: ['unstarted', 'in_progress', 'covered'] }).notNull().default('unstarted'),
  backlog: integer('backlog', { mode: 'boolean' }).notNull().default(false),
  sourceRef: text('source_ref'),
});

/** Exam window model — exact dates optional until datesheet confirmed. */
export const exams = table('exams', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['school', 'board', 'competitive'] }).notNull(),
  windowStart: text('window_start').notNull(), // ISO date
  windowEnd: text('window_end'),
  exactDates: text('exact_dates'), // JSON array of ISO dates when confirmed
  subjectIds: text('subject_ids').notNull(), // JSON array of subject ids
  datesheetConfirmed: integer('datesheet_confirmed', { mode: 'boolean' }).notNull().default(false),
});

export const classSessions = table('class_sessions', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  subjectId: text('subject_id').notNull(),
  weekday: integer('weekday').notNull(), // 0=Sun … 6=Sat
  startMin: integer('start_min').notNull(),
  endMin: integer('end_min').notNull(),
  room: text('room'),
});

export const studySessions = table('study_sessions', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  topicId: text('topic_id'),
  startedAt: integer('started_at').notNull(),
  minutes: integer('minutes').notNull(),
  confidenceSelf: integer('confidence_self'), // 1|2|3 rating after session
  source: text('source', { enum: ['timer', 'manual'] }).notNull().default('timer'),
  dayIndex: integer('day_index').notNull().default(0), // app-day ordinal for streak math
});

/** One row per planned item per day. done flags feed ring/streak. */
export const planItems = table('plan_items', {
  uid: text('uid').notNull(), // `t_<topicId>` — stable across re-solves (F21)
  studentId: text('student_id').notNull(),
  date: text('date').notNull(), // ISO date
  topicId: text('topic_id').notNull(),
  kind: text('kind', { enum: ['rev', 'new'] }).notNull(),
  durationMin: integer('duration_min').notNull(),
  startMin: integer('start_min'),
  reasonCode: text('reason_code'),
  examLinked: integer('exam_linked', { mode: 'boolean' }).notNull().default(false),
  carried: integer('carried', { mode: 'boolean' }).notNull().default(false),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
});

export const assessments = table('assessments', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  subjectId: text('subject_id').notNull(),
  name: text('name').notNull(),
  date: text('date'),
  maxMarks: integer('max_marks').default(100),
  marks: integer('marks').notNull(),
  baseline: integer('baseline', { mode: 'boolean' }).notNull().default(false),
});

/** Op log — powers sync (latest-wins + revertible change log, decision #4). */
export const syncLog = table('sync_log', {
  opId: text('op_id').primaryKey(),
  deviceId: text('device_id').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  op: text('op').notNull(), // add|cancel|move|edit|rate|log|…
  payload: text('payload').notNull(), // JSON
  clientTs: integer('client_ts').notNull(), // conflict resolution: latest wins
  appliedAt: integer('applied_at'),
  revertedBy: text('reverted_by'), // opId of reverting op (change-log undo)
});
