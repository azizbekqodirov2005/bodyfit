import { describe, expect, it } from 'vitest';
import {
  AGE_GROUPS,
  BodyFitError,
  calculateAge,
  calculateBMI,
  calculateLMSZScore,
  calculatePercentile,
  classifyAdultBMI,
  classifyChildBMI,
  getAgeGroup,
  getWHOReference,
  lmsValueAtZ,
  parseISODate,
  roundTo,
  standardizeLengthHeight,
} from '../src/lib/bmi.js';
import { readJSON } from './helpers.js';

const code = (fn) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BodyFitError);
    return e.code;
  }
  throw new Error('expected an error');
};

describe('calculateBMI', () => {
  it('computes weight / height²', () => {
    expect(calculateBMI(70, 175)).toBeCloseTo(22.857142857142858, 12);
    expect(calculateBMI(20, 100)).toBe(20);
    expect(calculateBMI(3.3, 50)).toBeCloseTo(13.2, 12);
  });
  it('keeps full precision (no early rounding)', () => {
    expect(calculateBMI(72.4, 181.3)).toBeCloseTo(72.4 / 1.813 ** 2, 13);
    expect(calculateBMI(72.4, 181.3)).not.toBe(22);
  });
  it('rejects invalid input', () => {
    expect(code(() => calculateBMI(0, 170))).toBe('INVALID_WEIGHT');
    expect(code(() => calculateBMI(-5, 170))).toBe('INVALID_WEIGHT');
    expect(code(() => calculateBMI(NaN, 170))).toBe('INVALID_WEIGHT');
    expect(code(() => calculateBMI(70, 0))).toBe('INVALID_HEIGHT');
    expect(code(() => calculateBMI(70, Infinity))).toBe('INVALID_HEIGHT');
  });
});

describe('dates and age', () => {
  it('parses only real calendar dates', () => {
    expect(parseISODate('2024-02-29')).not.toBeNull();
    expect(parseISODate('2023-02-29')).toBeNull();
    expect(parseISODate('2024-13-01')).toBeNull();
    expect(parseISODate('24-01-01')).toBeNull();
    expect(parseISODate('')).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
  });

  it('computes completed days and WHO months', () => {
    const a = calculateAge('2020-01-01', '2021-01-01');
    expect(a.totalDays).toBe(366);
    expect(a.ageInMonths).toBe(366 / 30.4375);
    expect([a.years, a.months, a.days]).toEqual([1, 0, 0]);
  });

  it('handles month-end and leap-year birthdays', () => {
    expect(calculateAge('2020-01-31', '2020-03-01')).toMatchObject({ years: 0, months: 1, days: 1, totalDays: 30 });
    expect(calculateAge('2020-02-29', '2021-02-27')).toMatchObject({ years: 0, months: 11, days: 29 });
    expect(calculateAge('2020-02-29', '2021-02-28')).toMatchObject({ years: 1, months: 0, days: 0 });
    expect(calculateAge('2020-02-29', '2021-03-01')).toMatchObject({ years: 1, months: 0, days: 1 });
    expect(calculateAge('2023-01-31', '2023-02-28')).toMatchObject({ years: 0, months: 1, days: 0 });
    expect(calculateAge('2000-12-15', '2001-01-10')).toMatchObject({ years: 0, months: 0, days: 26, totalDays: 26 });
  });

  it('accepts birth on the reference day and rejects future dates', () => {
    expect(calculateAge('2025-05-05', '2025-05-05').totalDays).toBe(0);
    expect(code(() => calculateAge('2025-05-06', '2025-05-05'))).toBe('FUTURE_BIRTH_DATE');
    expect(code(() => calculateAge('nope', '2025-05-05'))).toBe('INVALID_BIRTH_DATE');
  });

  it('is not affected by daylight-saving changes', () => {
    expect(calculateAge('2024-03-30', '2024-04-01').totalDays).toBe(2);
    expect(calculateAge('2024-10-26', '2024-10-28').totalDays).toBe(2);
  });
});

describe('WHO age-group boundaries', () => {
  const group = (birth, ref) => getAgeGroup(calculateAge(birth, ref));

  it('0–5 standard applies strictly below 60 months (1826.25 days)', () => {
    // 2019-01-01 → 2023-12-31 = 1825 days (59.96 months)
    expect(group('2019-01-01', '2023-12-31')).toBe(AGE_GROUPS.INFANT);
    expect(group('2019-01-01', '2024-01-01')).toBe(AGE_GROUPS.INFANT); // 1826 days = 59.99 mo
    expect(group('2019-01-01', '2024-01-02')).toBe(AGE_GROUPS.SCHOOL); // 1827 days = 60.02 mo
  });

  it('5–19 reference applies below 229 months', () => {
    const months = (m) => getAgeGroup({ ageInMonths: m, years: Math.floor(m / 12) });
    expect(months(60)).toBe(AGE_GROUPS.SCHOOL);
    expect(months(228.99)).toBe(AGE_GROUPS.SCHOOL);
    expect(months(229)).toBe(AGE_GROUPS.GAP);
  });

  it('adult classification starts at 20 completed years; 19-year-olds fall in the documented gap', () => {
    expect(group('2005-06-10', '2025-06-09')).toBe(AGE_GROUPS.GAP);
    expect(group('2005-06-10', '2025-06-10')).toBe(AGE_GROUPS.ADULT);
  });

  it('rejects unsupported ages', () => {
    expect(code(() => group('1900-01-01', '2025-01-01'))).toBe('UNSUPPORTED_AGE');
  });
});

describe('length / height standardisation (WHO Anthro)', () => {
  it('adds 0.7 cm when a child under 731 days is measured standing', () => {
    expect(standardizeLengthHeight(80, 730, 'height')).toEqual({ value: 80.7, adjustment: 0.7 });
    expect(standardizeLengthHeight(80, 730, 'length')).toEqual({ value: 80, adjustment: 0 });
  });
  it('subtracts 0.7 cm when a child from 731 days is measured lying down', () => {
    expect(standardizeLengthHeight(90, 731, 'length').value).toBeCloseTo(89.3, 12);
    expect(standardizeLengthHeight(90, 731, 'height')).toEqual({ value: 90, adjustment: 0 });
  });
  it('requires a measurement method', () => {
    expect(code(() => standardizeLengthHeight(90, 100, undefined))).toBe('INVALID_MEASUREMENT');
  });
});

describe('calculateLMSZScore', () => {
  const [l, m, s] = [-0.7151, 15.2679, 0.08366];

  it('applies the LMS formula', () => {
    expect(calculateLMSZScore(m, l, m, s)).toBeCloseTo(0, 15);
    const y = 17;
    expect(calculateLMSZScore(y, l, m, s)).toBeCloseTo(((y / m) ** l - 1) / (l * s), 14);
  });

  it('uses the logarithmic form when L = 0', () => {
    expect(calculateLMSZScore(20, 0, 18, 0.1)).toBeCloseTo(Math.log(20 / 18) / 0.1, 14);
    expect(lmsValueAtZ(1.5, 0, 18, 0.1)).toBeCloseTo(18 * Math.exp(0.15), 12);
  });

  it('applies the WHO restricted method beyond ±3 SD', () => {
    const sd3 = lmsValueAtZ(3, l, m, s);
    const sd2 = lmsValueAtZ(2, l, m, s);
    const y = sd3 + 0.5 * (sd3 - sd2);
    expect(calculateLMSZScore(y, l, m, s)).toBeCloseTo(3.5, 12);
    expect(calculateLMSZScore(y, l, m, s, { restricted: false })).not.toBeCloseTo(3.5, 2);

    const sd3n = lmsValueAtZ(-3, l, m, s);
    const sd2n = lmsValueAtZ(-2, l, m, s);
    expect(calculateLMSZScore(sd3n - (sd2n - sd3n), l, m, s)).toBeCloseTo(-4, 12);
  });

  it('is continuous at ±3', () => {
    const at3 = lmsValueAtZ(3, l, m, s);
    expect(calculateLMSZScore(at3, l, m, s)).toBeCloseTo(3, 12);
    expect(calculateLMSZScore(at3 * 1.000001, l, m, s)).toBeCloseTo(3, 4);
  });

  it('rejects impossible inputs', () => {
    expect(code(() => calculateLMSZScore(0, l, m, s))).toBe('INVALID_RESULT');
    expect(code(() => calculateLMSZScore(NaN, l, m, s))).toBe('INVALID_RESULT');
    expect(code(() => calculateLMSZScore(15, l, 0, s))).toBe('INVALID_RESULT');
  });
});

describe('calculatePercentile', () => {
  it('matches the standard normal distribution', () => {
    expect(calculatePercentile(0)).toBe(50);
    expect(calculatePercentile(1)).toBeCloseTo(84.13447460685429, 10);
    expect(calculatePercentile(-1)).toBeCloseTo(15.865525393145707, 10);
    expect(calculatePercentile(2)).toBeCloseTo(97.72498680518208, 10);
    expect(calculatePercentile(-2)).toBeCloseTo(2.275013194817921, 10);
    expect(calculatePercentile(1.6448536269514722)).toBeCloseTo(95, 10);
    expect(calculatePercentile(-3)).toBeCloseTo(0.13498980316301, 10);
  });
  it('is symmetric', () => {
    for (const z of [0.1, 0.77, 1.5, 2.8, 4.2]) {
      expect(calculatePercentile(z) + calculatePercentile(-z)).toBeCloseTo(100, 10);
    }
  });
  it('rejects non-finite z', () => {
    expect(code(() => calculatePercentile(NaN))).toBe('INVALID_RESULT');
  });
});

describe('classifyAdultBMI (WHO)', () => {
  const k = (b) => classifyAdultBMI(b).key;
  it('uses WHO cut-offs', () => {
    expect(k(16)).toBe('underweight');
    expect(k(18.4)).toBe('underweight');
    expect(k(18.5)).toBe('normal');
    expect(k(24.9)).toBe('normal');
    expect(k(25)).toBe('overweight');
    expect(k(29.9)).toBe('overweight');
    expect(k(30)).toBe('obesity1');
    expect(k(34.9)).toBe('obesity1');
    expect(k(35)).toBe('obesity2');
    expect(k(39.9)).toBe('obesity2');
    expect(k(40)).toBe('obesity3');
    expect(k(55)).toBe('obesity3');
  });
  it('classifies the value shown to the user (rounded to 1 decimal)', () => {
    expect(k(18.449)).toBe('underweight');
    expect(k(18.45)).toBe('normal');
    expect(k(24.94)).toBe('normal');
    expect(k(24.95)).toBe('overweight');
    expect(k(29.96)).toBe('obesity1');
  });
});

describe('classifyChildBMI (WHO)', () => {
  it('0–5 years: wasting / normal / risk / overweight / obese', () => {
    const k = (z) => classifyChildBMI(z, AGE_GROUPS.INFANT).key;
    expect(k(-3.01)).toBe('severeWasting');
    expect(k(-3)).toBe('wasting');
    expect(k(-2.01)).toBe('wasting');
    expect(k(-2)).toBe('normal');
    expect(k(1)).toBe('normal');
    expect(k(1.01)).toBe('riskOfOverweight');
    expect(k(2)).toBe('riskOfOverweight');
    expect(k(2.01)).toBe('overweight');
    expect(k(3)).toBe('overweight');
    expect(k(3.01)).toBe('obese');
  });

  it('5–19 years: thinness / normal / overweight / obesity', () => {
    const k = (z) => classifyChildBMI(z, AGE_GROUPS.SCHOOL).key;
    expect(k(-3.5)).toBe('severeThinness');
    expect(k(-3)).toBe('thinness');
    expect(k(-2)).toBe('normal');
    expect(k(0)).toBe('normal');
    expect(k(1)).toBe('normal');
    expect(k(1.004)).toBe('normal'); // rounds to 1.00
    expect(k(1.005)).toBe('overweight');
    expect(k(2)).toBe('overweight');
    expect(k(2.01)).toBe('obesity');
  });

  it('flags |z| > 5 as implausible instead of classifying', () => {
    expect(classifyChildBMI(5.2, AGE_GROUPS.SCHOOL).key).toBe('implausible');
    expect(classifyChildBMI(-5.01, AGE_GROUPS.INFANT).key).toBe('implausible');
    expect(classifyChildBMI(5, AGE_GROUPS.INFANT).key).toBe('obese');
  });

  it('refuses to classify outside child age groups', () => {
    expect(code(() => classifyChildBMI(0, AGE_GROUPS.ADULT))).toBe('REFERENCE_OUT_OF_RANGE');
  });
});

describe('getWHOReference', () => {
  const boys05 = readJSON('public/data/who-0-5-boys.json');
  const girls519 = readJSON('public/data/who-5-19-girls.json');

  it('0–5: returns the exact daily row without interpolation', () => {
    const r = getWHOReference(boys05, AGE_GROUPS.INFANT, { totalDays: 730, ageInMonths: 730 / 30.4375 });
    expect(r).toMatchObject({ l: -0.6473, m: 15.7356, s: 0.07771, basis: 'length' });
    const h = getWHOReference(boys05, AGE_GROUPS.INFANT, { totalDays: 731, ageInMonths: 731 / 30.4375 });
    expect(h).toMatchObject({ l: -0.6187, m: 16.0189, s: 0.07785, basis: 'height' });
  });

  it('5–19: interpolates linearly between adjacent months (WHO AnthroPlus)', () => {
    const lo = girls519.rows.find((r) => r[0] === 100);
    const hi = girls519.rows.find((r) => r[0] === 101);
    const r = getWHOReference(girls519, AGE_GROUPS.SCHOOL, { ageInMonths: 100.25 });
    expect(r.m).toBeCloseTo(lo[2] + 0.25 * (hi[2] - lo[2]), 12);
    expect(r.l).toBeCloseTo(lo[1] + 0.25 * (hi[1] - lo[1]), 12);
    expect(r.s).toBeCloseTo(lo[3] + 0.25 * (hi[3] - lo[3]), 12);
    const exact = getWHOReference(girls519, AGE_GROUPS.SCHOOL, { ageInMonths: 100 });
    expect(exact.m).toBe(lo[2]);
  });

  it('never substitutes another age group or table', () => {
    expect(code(() => getWHOReference(boys05, AGE_GROUPS.SCHOOL, { ageInMonths: 70 }))).toBe('REFERENCE_MISMATCH');
    expect(code(() => getWHOReference(girls519, AGE_GROUPS.SCHOOL, { ageInMonths: 229 }))).toBe('REFERENCE_OUT_OF_RANGE');
    expect(code(() => getWHOReference(girls519, AGE_GROUPS.SCHOOL, { ageInMonths: 59.9 }))).toBe('REFERENCE_OUT_OF_RANGE');
    expect(code(() => getWHOReference(girls519, AGE_GROUPS.ADULT, { ageInMonths: 300 }))).toBe('REFERENCE_OUT_OF_RANGE');
  });

  it('reports missing reference data instead of guessing', () => {
    expect(code(() => getWHOReference(null, AGE_GROUPS.INFANT, { totalDays: 10, ageInMonths: 0.3 }))).toBe('REFERENCE_MISSING');
    expect(code(() => getWHOReference({ ...boys05, rows: [] }, AGE_GROUPS.INFANT, { totalDays: 10, ageInMonths: 0.3 }))).toBe(
      'REFERENCE_MISSING',
    );
    const holed = { ...girls519, rows: girls519.rows.filter((r) => r[0] !== 101) };
    expect(code(() => getWHOReference(holed, AGE_GROUPS.SCHOOL, { ageInMonths: 100.5 }))).toBe('REFERENCE_MISSING');
    const truncated = { ...boys05, rows: boys05.rows.slice(0, 100) };
    expect(code(() => getWHOReference(truncated, AGE_GROUPS.INFANT, { totalDays: 500, ageInMonths: 16.4 }))).toBe(
      'REFERENCE_MISSING',
    );
  });
});

describe('roundTo', () => {
  it('rounds half away from zero, robust to binary artefacts', () => {
    expect(roundTo(24.95, 1)).toBe(25);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-2.005, 2)).toBe(-2.01);
    expect(roundTo(22.857142, 1)).toBe(22.9);
  });
});
