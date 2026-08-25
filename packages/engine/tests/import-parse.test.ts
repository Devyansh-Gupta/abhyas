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

describe('parseSyllabusText — letter-spaced OCR caps (real NCERT artifact)', () => {
  it('collapses "QU E S TI N S" and "C H A P T E R  1" into headers', () => {
    const r = parseSyllabusText([
      'C H E M I C A L   R E A C T I O N S',
      '2 TYPES OF CHEMICAL REACTIONS',
      'Q U E S TI O NS',
      'Why should a magnesium ribbon be cleaned before burning in air?',
      'Write the balanced equation for the following chemical reactions.',
    ]);
    expect(r.subjects).toEqual([
      { name: 'CHEMICAL REACTIONS', topics: ['TYPES OF CHEMICAL REACTIONS'] },
      {
        name: 'QUESTIONS',
        topics: [
          'Why should a magnesium ribbon be cleaned before burning in air?',
          'Write the balanced equation for the following chemical reactions.',
        ],
      },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('does not collapse normal multi-word caps or mixed-case lines', () => {
    expect(parseSyllabusText(['SOCIAL SCIENCE']).subjects[0]?.name).toBe('SOCIAL SCIENCE');
    expect(parseSyllabusText(['Quadratic Equations chapter']).subjects).toEqual([]);
  });
});

describe('parseSyllabusText — subsection lines ("2.1 Title") are topics, not headers', () => {
  it('appends numbered subsections to the current subject with numbering stripped', () => {
    const r = parseSyllabusText([
      'CHEMICAL REACTIONS AND EQUATIONS',
      '1. Chemical Reactions and Equations',
      '2 TYPES OF CHEMICAL REACTIONS',
      '2.1 Combination Reaction',
      '2.2 Decomposition Reaction',
      '2.3 Displacement Reaction',
    ]);
    expect(r.subjects).toEqual([
      {
        name: 'CHEMICAL REACTIONS AND EQUATIONS',
        topics: [
          'Chemical Reactions and Equations',
          'TYPES OF CHEMICAL REACTIONS',
          'Combination Reaction',
          'Decomposition Reaction',
          'Displacement Reaction',
        ],
      },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('a "2.1 Title:" line still counts as a header', () => {
    const r = parseSyllabusText(['CHEMISTRY', '2.1 Combination Reaction:', 'Magnesium + Oxygen']);
    expect(r.subjects).toEqual([
      { name: 'CHEMISTRY', topics: [] },
      { name: '2.1 Combination Reaction', topics: ['Magnesium + Oxygen'] },
    ]);
  });
});

describe('parseSyllabusText — question-density hint (exercise page)', () => {
  const questions = [
    'Why should a magnesium ribbon be cleaned before burning in air?',
    'Write the balanced equation for the following chemical reactions.',
    'What happens when dilute hydrochloric acid is added to iron filings?',
    'Why is respiration considered an exothermic reaction?',
  ];

  it('warns when more than 60% of topics end with "?"', () => {
    const r = parseSyllabusText(['QUESTIONS', ...questions]);
    expect(r.warnings).toEqual([
      'This looks like an exercise/questions page rather than a topic list — review carefully before importing.',
    ]);
  });

  it('does not warn when only some topics are questions', () => {
    const r = parseSyllabusText(['SCIENCE', 'Acids, Bases and Salts', ...questions.slice(0, 1)]);
    expect(r.warnings).toEqual([]);
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
