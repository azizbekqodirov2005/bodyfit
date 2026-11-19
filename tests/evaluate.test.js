import { describe, expect, it } from 'vitest';
import { AGE_GROUPS, BodyFitError } from '../src/lib/bmi.js';
import { evaluateBMI } from '../src/lib/evaluate.js';
import { normalizeHeight, parseDecimal, sanitizeDecimalInput, validateInput } from '../src/lib/validation.js';
import { validateTable } from '../src/lib/whoData.js';
import { loadTableFromDisk, readJSON } from './helpers.js';

const REF = '2025-06-15';
const run = (input) => evaluateBMI({ referenceDate: REF, ...input }, loadTableFromDisk);
const errorCode = async (p) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(BodyFitError);
    return e.code;
  }
  throw new Error('expected an error');
};

describe('evaluateBMI — adults', () => {
  it('classifies with WHO adult cut-offs and gives the normal-BMI weight range', async () => {
    const r = await run({ birthDate: '1990-03-10', sex: 'male', heightCm: 175, weightKg: 70 });
    expect(r.group).toBe(AGE_GROUPS.ADULT);
    expect(r.bmi).toBeCloseTo(22.857, 3);
    expect(r.classification.key).toBe('normal');
    expect(r.normalWeightRange.min).toBeCloseTo(56.66, 2);
    expect(r.normalWeightRange.max).toBeCloseTo(76.26, 2);
    expect(r.z).toBeUndefined();
  });

  it('rejects physically implausible BMI', async () => {
    expect(await errorCode(run({ birthDate: '1990-03-10', sex: 'female', heightCm: 250, weightKg: 5 }))).toBe('IMPLAUSIBLE_BMI');
  });
});

describe('evaluateBMI — 19-year gap', () => {
  it('returns BMI without a classification (no WHO reference covers this age)', async () => {
    const r = await run({ birthDate: '2006-01-01', sex: 'female', heightCm: 165, weightKg: 58 });
    expect(r.group).toBe(AGE_GROUPS.GAP);
    expect(r.classification).toBeUndefined();
    expect(r.z).toBeUndefined();
  });
});

describe('evaluateBMI — children 5–19', () => {
  it('end-to-end from dates matches the official WHO survey record (id 1)', async () => {
    // id 1: boy, born 1987-01-03, measured 2000-11-21, 50.7 kg, 153.7 cm → WHO zbfa 0.94.
    // (The survey stores age as 166.59 months; from the dates it is 5071 days = 166.60 months.)
    const r = await evaluateBMI(
      { birthDate: '1987-01-03', referenceDate: '2000-11-21', sex: 'male', heightCm: 153.7, weightKg: 50.7 },
      loadTableFromDisk,
    );
    expect(r.group).toBe(AGE_GROUPS.SCHOOL);
    expect(r.age.totalDays).toBe(5071);
    expect(Math.abs(r.z - 0.94)).toBeLessThan(0.006);
    expect(r.classification.key).toBe('normal');
    expect(r.percentile).toBeCloseTo(82.6, 0);
  });

  it('uses the girls table for girls and the boys table for boys', async () => {
    const boy = await run({ birthDate: '2015-06-15', sex: 'male', heightCm: 140, weightKg: 35 });
    const girl = await run({ birthDate: '2015-06-15', sex: 'female', heightCm: 140, weightKg: 35 });
    expect(boy.bmi).toBe(girl.bmi);
    expect(boy.z).not.toBe(girl.z);
    expect(boy.reference.m).not.toBe(girl.reference.m);
  });

  it('flags implausible z-scores', async () => {
    const r = await run({ birthDate: '2015-06-15', sex: 'male', heightCm: 120, weightKg: 90 });
    expect(r.implausible).toBe(true);
    expect(r.classification.key).toBe('implausible');
  });
});

describe('evaluateBMI — children 0–5', () => {
  it('uses the exact daily row and the measurement adjustment', async () => {
    // 2024-06-15 → 2025-06-15 = 365 days; length board measurement
    const lying = await run({ birthDate: '2024-06-15', sex: 'female', heightCm: 74, weightKg: 9, measurement: 'length' });
    expect(lying.group).toBe(AGE_GROUPS.INFANT);
    expect(lying.reference.age).toBe(365);
    expect(lying.usedHeight).toBe(74);
    const girls = readJSON('public/data/who-0-5-girls.json');
    expect(lying.reference.m).toBe(girls.rows[365][2]);

    const standing = await run({ birthDate: '2024-06-15', sex: 'female', heightCm: 74, weightKg: 9, measurement: 'height' });
    expect(standing.usedHeight).toBeCloseTo(74.7, 12);
    expect(standing.bmi).toBeLessThan(lying.bmi);
  });

  it('BMI on the median curve gives z = 0 and the 50th percentile', async () => {
    const boys = readJSON('public/data/who-0-5-boys.json');
    const m = boys.rows[1000][2]; // day 1000 (standing height)
    const heightCm = 95;
    const weightKg = m * (heightCm / 100) ** 2;
    const r = await evaluateBMI(
      { birthDate: '2022-01-01', referenceDate: '2024-09-27', sex: 'male', heightCm, weightKg, measurement: 'height' },
      loadTableFromDisk,
    );
    expect(r.age.totalDays).toBe(1000);
    expect(r.z).toBeCloseTo(0, 10);
    expect(r.percentile).toBeCloseTo(50, 8);
  });

  it('newborn on the day of birth uses day 0', async () => {
    const r = await run({ birthDate: REF, sex: 'male', heightCm: 50, weightKg: 3.3, measurement: 'length' });
    expect(r.reference.age).toBe(0);
  });
});

describe('evaluateBMI — errors', () => {
  it('rejects a missing or invalid sex', async () => {
    expect(await errorCode(run({ birthDate: '2010-01-01', sex: '', heightCm: 140, weightKg: 35 }))).toBe('INVALID_SEX');
  });

  it('reports missing reference data and never returns a result', async () => {
    const missing = () => Promise.reject(new Error('404'));
    const p = evaluateBMI({ birthDate: '2015-01-01', referenceDate: REF, sex: 'male', heightCm: 140, weightKg: 35 }, missing);
    expect(await errorCode(p)).toBe('REFERENCE_MISSING');
  });

  it('rejects corrupt reference files', () => {
    const t = readJSON('public/data/who-5-19-boys.json');
    expect(() => validateTable({ ...t, rows: t.rows.map((r, i) => (i === 5 ? [r[0], r[1], 0, r[3]] : r)) }, '5-19')).toThrow();
    expect(() => validateTable({ ...t, ageUnit: 'day' }, '5-19')).toThrow();
    expect(() => validateTable(t, '5-19')).not.toThrow();
  });

  it('rejects a future birth date', async () => {
    expect(await errorCode(run({ birthDate: '2030-01-01', sex: 'male', heightCm: 140, weightKg: 35 }))).toBe('FUTURE_BIRTH_DATE');
  });

  it('requires a measurement method under 5 years', async () => {
    expect(await errorCode(run({ birthDate: '2023-01-01', sex: 'male', heightCm: 90, weightKg: 13 }))).toBe('INVALID_MEASUREMENT');
  });
});

describe('validateInput', () => {
  const ok = { birthDate: '1995-05-05', sex: 'female', height: '165', weight: '60' };

  it('accepts valid input', () => {
    expect(validateInput(ok, REF)).toEqual({});
    expect(validateInput({ ...ok, height: '165,5', weight: '60,2' }, REF)).toEqual({});
  });

  it('reports every missing field in Uzbek', () => {
    const e = validateInput({ birthDate: '', sex: '', height: '', weight: '' }, REF);
    expect(e.birthDate).toBe("Tug'ilgan sanani tanlang (kun, oy va yil).");
    expect(e.sex).toBe('Jinsni tanlang.');
    expect(e.height).toBe("Bo'yni kiriting.");
    expect(e.weight).toBe('Vaznni kiriting.');
  });

  it('rejects future and unsupported birth dates', () => {
    expect(validateInput({ ...ok, birthDate: '2025-06-16' }, REF).birthDate).toMatch(/kelajak/);
    expect(validateInput({ ...ok, birthDate: '2025-06-15' }, REF).birthDate).toBeUndefined();
    expect(validateInput({ ...ok, birthDate: '1890-01-01' }, REF).birthDate).toMatch(/qo'llab-quvvatlanmaydi/);
    expect(validateInput({ ...ok, birthDate: '2023-02-30' }, REF).birthDate).toMatch(/noto'g'ri/);
  });

  it('rejects non-numeric and out-of-range measurements (boundaries inclusive)', () => {
    expect(validateInput({ ...ok, height: 'abc' }, REF).height).toBeDefined();
    expect(validateInput({ ...ok, height: '-170' }, REF).height).toBeDefined();
    expect(validateInput({ ...ok, height: '29.9' }, REF).height).toBeDefined();
    expect(validateInput({ ...ok, height: '0.2' }, REF).height).toBeDefined();
    expect(validateInput({ ...ok, height: '2.7' }, REF).height).toBeDefined();
    expect(validateInput({ ...ok, height: '30' }, REF).height).toBeUndefined();
    expect(validateInput({ ...ok, height: '260' }, REF).height).toBeUndefined();
    expect(validateInput({ ...ok, height: '260.1' }, REF).height).toBeDefined();
    expect(validateInput({ ...ok, weight: '0' }, REF).weight).toBeDefined();
    expect(validateInput({ ...ok, weight: '0.5' }, REF).weight).toBeUndefined();
    expect(validateInput({ ...ok, weight: '501' }, REF).weight).toBeDefined();
    expect(validateInput({ ...ok, weight: '1e3' }, REF).weight).toBeDefined();
  });

  it('parseDecimal accepts comma and dot decimals only', () => {
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal(' 72.5 ')).toBe(72.5);
    expect(parseDecimal('7 2')).toBe(72);
    expect(parseDecimal('72kg')).toBeNaN();
    expect(parseDecimal('')).toBeNaN();
  });
});

describe('height in metres', () => {
  it('reads 0,3–2,6 as metres and converts to centimetres', () => {
    expect(normalizeHeight('1,80')).toEqual({ cm: 180, fromMetres: true });
    expect(normalizeHeight('1.20')).toEqual({ cm: 120, fromMetres: true });
    expect(normalizeHeight('2,2')).toEqual({ cm: 220, fromMetres: true });
    expect(normalizeHeight('1.75').cm).toBe(175);
    expect(normalizeHeight('0,5')).toEqual({ cm: 50, fromMetres: true });
  });
  it('keeps centimetre values as they are', () => {
    expect(normalizeHeight('180')).toEqual({ cm: 180, fromMetres: false });
    expect(normalizeHeight('45,5')).toEqual({ cm: 45.5, fromMetres: false });
  });
  it('validates metre input as valid height', () => {
    const ok = { birthDate: '1995-05-05', sex: 'female', weight: '60' };
    expect(validateInput({ ...ok, height: '1,20' }, REF).height).toBeUndefined();
    expect(validateInput({ ...ok, height: '1.80' }, REF).height).toBeUndefined();
  });
});

describe('sanitizeDecimalInput', () => {
  it('drops letters and symbols', () => {
    expect(sanitizeDecimalInput('17a0')).toBe('170');
    expect(sanitizeDecimalInput('abc')).toBe('');
    expect(sanitizeDecimalInput('-65kg')).toBe('65');
    expect(sanitizeDecimalInput('1e3')).toBe('13');
  });
  it('keeps a single separator and limits digits', () => {
    expect(sanitizeDecimalInput('1,8,0')).toBe('1,80');
    expect(sanitizeDecimalInput('72.555')).toBe('72.55');
    expect(sanitizeDecimalInput('12345')).toBe('123');
    expect(sanitizeDecimalInput(',5')).toBe('0,5');
    expect(sanitizeDecimalInput('65,')).toBe('65,');
  });
});
