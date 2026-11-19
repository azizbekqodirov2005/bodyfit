// Verification against official WHO material.
import { describe, expect, it } from 'vitest';
import {
  AGE_GROUPS,
  calculateLMSZScore,
  getWHOReference,
  lmsValueAtZ,
  roundTo,
} from '../src/lib/bmi.js';
import { parseCSV, readJSON, readText } from './helpers.js';

const tables = {
  '0-5': { male: readJSON('public/data/who-0-5-boys.json'), female: readJSON('public/data/who-0-5-girls.json') },
  '5-19': { male: readJSON('public/data/who-5-19-boys.json'), female: readJSON('public/data/who-5-19-girls.json') },
};

describe('WHO datasets', () => {
  it('cover the documented age ranges with no gaps', () => {
    for (const sex of ['male', 'female']) {
      expect(tables['0-5'][sex].ageMin).toBe(0);
      expect(tables['0-5'][sex].ageMax).toBe(1826);
      expect(tables['0-5'][sex].rows).toHaveLength(1827);
      expect(tables['5-19'][sex].ageMin).toBe(60);
      expect(tables['5-19'][sex].ageMax).toBe(229);
      expect(tables['5-19'][sex].rows).toHaveLength(170);
    }
  });

  it('keep male and female tables distinct', () => {
    expect(tables['0-5'].male.sex).toBe('boys');
    expect(tables['0-5'].female.sex).toBe('girls');
    expect(tables['0-5'].male.rows[0]).toEqual([0, -0.3053, 13.4069, 0.0956, 'L']);
    expect(tables['0-5'].female.rows[0]).toEqual([0, -0.0631, 13.3363, 0.09272, 'L']);
    expect(tables['5-19'].male.rows[0]).toEqual([60, -0.7151, 15.2679, 0.08366]);
    expect(tables['5-19'].male.rows[1]).toEqual([61, -0.7387, 15.2641, 0.0839]);
  });

  it('switch from recumbent length to standing height at day 731', () => {
    for (const sex of ['male', 'female']) {
      const rows = tables['0-5'][sex].rows;
      expect(rows[730][4]).toBe('L');
      expect(rows[731][4]).toBe('H');
    }
  });

  it('record the source and checksum of every file', () => {
    for (const group of Object.values(tables)) {
      for (const t of Object.values(group)) {
        expect(t.source.repository).toMatch(/^https:\/\/github\.com\/WorldHealthOrganization\//);
        expect(t.source.commit).toMatch(/^[0-9a-f]{40}$/);
        expect(t.source.rawFileSha256).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });
});

describe('WHO Child Growth Standards — published weekly BMI-for-age tables (0–13 weeks)', () => {
  // Fixture: WHO "bfa_boys/girls_z_exp" weekly tables (L, M, S and SD curves to 1 decimal).
  for (const [sex, file] of [
    ['male', 'tests/fixtures/who-bfa-boys-0-13-weeks.json'],
    ['female', 'tests/fixtures/who-bfa-girls-0-13-weeks.json'],
  ]) {
    const published = readJSON(file);
    it(`${sex}: LMS and SD curves match the daily table`, () => {
      for (const row of published) {
        const day = Number(row.Week) * 7;
        const ref = getWHOReference(tables['0-5'][sex], AGE_GROUPS.INFANT, { totalDays: day, ageInMonths: day / 30.4375 });
        expect(ref.l).toBeCloseTo(Number(row.L), 4);
        expect(ref.m).toBeCloseTo(Number(row.M), 4);
        expect(ref.s).toBeCloseTo(Number(row.S), 5);
        const keys = { '-3': 'SD3neg', '-2': 'SD2neg', '-1': 'SD1neg', 0: 'SD0', 1: 'SD1', 2: 'SD2', 3: 'SD3' };
        for (const [z, key] of Object.entries(keys)) {
          expect(roundTo(lmsValueAtZ(Number(z), ref.l, ref.m, ref.s), 1)).toBe(Number(row[key]));
          // The LMS z-score at an SD curve value must be exactly that SD.
          const at = lmsValueAtZ(Number(z), ref.l, ref.m, ref.s);
          expect(calculateLMSZScore(at, ref.l, ref.m, ref.s)).toBeCloseTo(Number(z), 10);
        }
      }
    });
  }
});

describe('WHO Growth Reference 2007 — official survey results (5–19 years)', () => {
  // Fixture: WHO AnthroPlus example survey with WHO-computed z-scores
  // (anthroplus/data-raw/survey_who2007_z.csv).
  const rows = parseCSV(readText('tests/fixtures/who2007-survey-official-zscores.csv'));

  it('fixture has the expected size', () => {
    expect(rows.length).toBe(933);
  });

  it('BMI-for-age z-scores reproduce every official WHO value', () => {
    let compared = 0;
    const mismatches = [];
    for (const r of rows) {
      if (r.zbfa === '' || r.zbfa === 'NA') continue;
      const sex = r.sex === '1' ? 'male' : 'female';
      const months = Number(r.agemons);
      const bmi = Number(r.weight) / (Number(r.height) / 100) ** 2;
      expect(bmi).toBeCloseTo(Number(r.cbmi), 10);
      const ref = getWHOReference(tables['5-19'][sex], AGE_GROUPS.SCHOOL, { ageInMonths: months });
      const z = roundTo(calculateLMSZScore(bmi, ref.l, ref.m, ref.s), 2);
      if (Math.abs(z - Number(r.zbfa)) > 1e-9) mismatches.push({ id: r.id, ours: z, who: Number(r.zbfa) });
      compared++;
    }
    expect(compared).toBeGreaterThan(850);
    expect(mismatches).toEqual([]);
  });
});
