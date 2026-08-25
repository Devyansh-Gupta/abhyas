import { describe, it, expect } from 'vitest';
import { parseSyllabusText } from '../src/import/parse.js';

describe('parseSyllabusText — CBSE datesheet-style dump (ALL-CAPS headers)', () => {
  const dump = [
    'CBSE Class X - Annual Examination 2026',
    'Datesheet scanned on 15 Feb',
    '',
    'MATHEMATICS',
    '1. Real Numbers',
    '2. Quadratic Equations',
    '3. Arithmetic Progressions',
    '',
    'SCIENCE & TECHNOLOGY',
    'Chemical Reactions and Equations',
    'Acids, Bases and Salts',
    '',
    'SOCIAL SCIENCE',
    '1) Nationalism in India',
    '2) The Making of a Global World',
  ];

  it('parses three subjects with stripped numbering', () => {
    const r = parseSyllabusText(dump);
    expect(r.subjects).toEqual([
      {
        name: 'MATHEMATICS',
        topics: ['Real Numbers', 'Quadratic Equations', 'Arithmetic Progressions'],
      },
      {
        name: 'SCIENCE & TECHNOLOGY',
        topics: ['Chemical Reactions and Equations', 'Acids, Bases and Salts'],
      },
      {
        name: 'SOCIAL SCIENCE',
        topics: ['Nationalism in India', 'The Making of a Global World'],
      },
    ]);
  });

  it('counts the two pre-header banner lines as ignored', () => {
    const r = parseSyllabusText(dump);
    expect(r.warnings).toEqual(['2 lines before first subject ignored']);
  });
});

describe('parseSyllabusText — handwritten-style notes with Subject/Sub prefixes', () => {
  it('detects "sub:" and "Subject -" prefixes and extracts names', () => {
    const r = parseSyllabusText([
      'sub: Algebra',
      '1. Linear Equations in Two Variables',
      '2. Polynomials',
      'Subject - Geometry',
      '• Triangles',
      '- Circles',
    ]);
    expect(r.subjects).toEqual([
      { name: 'Algebra', topics: ['Linear Equations in Two Variables', 'Polynomials'] },
      { name: 'Geometry', topics: ['Triangles', 'Circles'] },
    ]);
    expect(r.warnings).toEqual([]);
  });
});

describe('parseSyllabusText — all-caps textbook chapter list with dash bullets', () => {
  it('keeps ALL-CAPS chapter names verbatim, strips bullets from topics', () => {
    const r = parseSyllabusText([
      'PHYSICAL FEATURES OF INDIA',
      '- The Himalayan Mountains',
      '- The Northern Plains',
      '- The Peninsular Plateau',
      'DRAINAGE',
      '• The Himalayan Rivers',
    ]);
    expect(r.subjects).toEqual([
      {
        name: 'PHYSICAL FEATURES OF INDIA',
        topics: ['The Himalayan Mountains', 'The Northern Plains', 'The Peninsular Plateau'],
      },
      { name: 'DRAINAGE', topics: ['The Himalayan Rivers'] },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('header directly followed by another header yields empty topics', () => {
    const r = parseSyllabusText(['CHEMISTRY', 'BIOLOGY']);
    expect(r.subjects).toEqual([
      { name: 'CHEMISTRY', topics: [] },
      { name: 'BIOLOGY', topics: [] },
    ]);
  });
});

describe('parseSyllabusText — garbage / empty OCR results never fail silently', () => {
  it('empty input produces the retry warning', () => {
    expect(parseSyllabusText([])).toEqual({
      subjects: [],
      warnings: ['No subject headers detected — try better lighting or a clearer photo'],
    });
  });

  it('blank-only input produces the retry warning', () => {
    expect(parseSyllabusText(['   ', '', '\t'])).toEqual({
      subjects: [],
      warnings: ['No subject headers detected — try better lighting or a clearer photo'],
    });
  });

  it('garbage text warns about no headers and counts ignored lines', () => {
    const r = parseSyllabusText(['asdkjh qwerty zzz', '', '12345']);
    expect(r.subjects).toEqual([]);
    expect(r.warnings).toEqual([
      '2 lines before first subject ignored',
      'No subject headers detected — try better lighting or a clearer photo',
    ]);
  });
});

describe('parseSyllabusText — mixed-case mess with one detectable subject', () => {
  it('finds only the colon-terminated header among noise', () => {
    const r = parseSyllabusText([
      'notes from today',
      'maths homework pg 42',
      'Mathematics:',
      'Linear Equations',
      'Pair of Linear Equations in Two Variables',
    ]);
    expect(r.subjects).toEqual([
      {
        name: 'Mathematics',
        topics: ['Linear Equations', 'Pair of Linear Equations in Two Variables'],
      },
    ]);
    expect(r.warnings).toEqual(['2 lines before first subject ignored']);
  });
});
