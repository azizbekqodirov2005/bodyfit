// BodyFit scientific calculation engine.
//
// Everything in this file is pure (no DOM, no network) so it can be unit-tested
// and reused. Values are kept at full double precision; rounding happens only
// where WHO methodology itself rounds (see notes) or in the UI.
//
// Methodology follows the WHO reference implementations:
//   - 0–5 years:  WHO Anthro (R package `anthro`), BMI-for-age
//   - 5–19 years: WHO AnthroPlus (R package `anthroplus`), BMI-for-age
//   - adults:     WHO BMI classification for adults

import { normalCdf } from './stats.js';

/** WHO uses 365.25 / 12 days per month (ANTHRO_DAYS_OF_MONTH). */
export const DAYS_PER_MONTH = 30.4375;

/** Age groups. Boundaries come from the WHO packages. */
export const AGE_GROUPS = {
  INFANT: '0-5', // age < 60 months (WHO Child Growth Standards)
  SCHOOL: '5-19', // 60 ≤ age < 229 months (WHO Growth Reference 2007)
  GAP: 'gap', // 229 months ≤ age < 20 years: no WHO BMI-for-age reference
  ADULT: 'adult', // age ≥ 20 years
};

/** Upper limit (exclusive, in months) of the WHO 2007 BMI-for-age reference. */
export const SCHOOL_AGE_UPPER_MONTHS = 229;
export const ADULT_MIN_YEARS = 20;
export const MAX_SUPPORTED_YEARS = 120;

/** |z| above this value is flagged by WHO as a probable data error (BMI-for-age). */
export const IMPLAUSIBLE_Z = 5;

/** Length/height measured lying down vs standing (relevant for age < 5 years). */
export const MEASUREMENT = { LENGTH: 'length', HEIGHT: 'height' };

/** First day (in completed days) from which WHO uses standing height. */
export const HEIGHT_FROM_DAY = 731;

export class BodyFitError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'BodyFitError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Dates and age
// ---------------------------------------------------------------------------

/**
 * Parses a calendar date in ISO format (YYYY-MM-DD). Returns a UTC day number
 * plus its parts, or null if the string is not a real calendar date.
 */
export function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const time = Date.UTC(y, m - 1, d);
  const check = new Date(time);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return { year: y, month: m, day: d, dayNumber: time / 86_400_000 };
}

/** Today's date in the user's local calendar, as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInMonth(year, month /* 1-12 */) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Age between a birth date and a reference date (both YYYY-MM-DD).
 *
 * Returns:
 *   totalDays    completed days (integer) — used for the 0–5 table
 *   ageInMonths  totalDays / 30.4375 (unrounded) — WHO convention
 *   years, months, days — calendar breakdown for display
 */
export function calculateAge(birthDate, referenceDate) {
  const birth = parseISODate(birthDate);
  const ref = parseISODate(referenceDate);
  if (!birth) throw new BodyFitError('INVALID_BIRTH_DATE');
  if (!ref) throw new BodyFitError('INVALID_REFERENCE_DATE');

  const totalDays = ref.dayNumber - birth.dayNumber;
  if (totalDays < 0) throw new BodyFitError('FUTURE_BIRTH_DATE');

  // Calendar breakdown: the latest "month anniversary" of the birth date on or
  // before the reference date (birth day clamped to the month's length, so a
  // birth on the 31st has its anniversary on the 30th/28th in shorter months).
  const anniversary = (totalMonths) => {
    const y = birth.year + Math.floor((birth.month - 1 + totalMonths) / 12);
    const m = ((birth.month - 1 + totalMonths) % 12) + 1;
    const d = Math.min(birth.day, daysInMonth(y, m));
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  let totalMonths = (ref.year - birth.year) * 12 + (ref.month - birth.month);
  if (anniversary(totalMonths) > ref.dayNumber) totalMonths -= 1;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const days = ref.dayNumber - anniversary(totalMonths);

  return {
    totalDays,
    ageInMonths: totalDays / DAYS_PER_MONTH,
    years,
    months,
    days,
  };
}

/** Which reference applies to a given age (result of calculateAge). */
export function getAgeGroup(age) {
  if (age.years >= MAX_SUPPORTED_YEARS) throw new BodyFitError('UNSUPPORTED_AGE');
  if (age.ageInMonths < 60) return AGE_GROUPS.INFANT;
  if (age.ageInMonths < SCHOOL_AGE_UPPER_MONTHS) return AGE_GROUPS.SCHOOL;
  if (age.years < ADULT_MIN_YEARS) return AGE_GROUPS.GAP;
  return AGE_GROUPS.ADULT;
}

// ---------------------------------------------------------------------------
// BMI
// ---------------------------------------------------------------------------

/** BMI = weight (kg) / height (m)². */
export function calculateBMI(weightKg, heightCm) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new BodyFitError('INVALID_WEIGHT');
  if (!Number.isFinite(heightCm) || heightCm <= 0) throw new BodyFitError('INVALID_HEIGHT');
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  if (!Number.isFinite(bmi)) throw new BodyFitError('INVALID_RESULT');
  return bmi;
}

/**
 * WHO standardisation of length/height for children under 5 (anthro::adjust_lenhei):
 * the 0–2 year standard uses recumbent length, the 2–5 year standard uses
 * standing height. Standing height under 731 days gets +0.7 cm; recumbent
 * length from 731 days gets −0.7 cm.
 */
export function standardizeLengthHeight(heightCm, totalDays, measurement) {
  if (measurement !== MEASUREMENT.LENGTH && measurement !== MEASUREMENT.HEIGHT) {
    throw new BodyFitError('INVALID_MEASUREMENT');
  }
  if (totalDays < HEIGHT_FROM_DAY && measurement === MEASUREMENT.HEIGHT) {
    return { value: heightCm + 0.7, adjustment: 0.7 };
  }
  if (totalDays >= HEIGHT_FROM_DAY && measurement === MEASUREMENT.LENGTH) {
    return { value: heightCm - 0.7, adjustment: -0.7 };
  }
  return { value: heightCm, adjustment: 0 };
}

// ---------------------------------------------------------------------------
// WHO reference tables and LMS
// ---------------------------------------------------------------------------

function findRow(table, age) {
  const index = age - table.ageMin;
  const row = table.rows[index];
  if (!row || row[0] !== age) return null;
  return row;
}

function assertTable(table, expectedUnit) {
  if (!table || !Array.isArray(table.rows) || table.rows.length === 0) {
    throw new BodyFitError('REFERENCE_MISSING');
  }
  if (table.ageUnit !== expectedUnit) throw new BodyFitError('REFERENCE_MISMATCH');
}

/**
 * Returns the L, M, S parameters for an age from an official WHO table.
 *
 * - 0–5 years (`ageUnit: 'day'`): exact row for the age in completed days.
 *   No interpolation (WHO Anthro looks up the daily table directly).
 * - 5–19 years (`ageUnit: 'month'`): linear interpolation of L, M and S
 *   between the two adjacent whole months — this is exactly what the WHO
 *   AnthroPlus software and the WHO 2007 macros do.
 *
 * Throws REFERENCE_MISSING if the needed rows are absent; never falls back to
 * a neighbouring age or to another age group's table.
 */
export function getWHOReference(table, group, age) {
  if (group === AGE_GROUPS.INFANT) {
    assertTable(table, 'day');
    if (!(age.ageInMonths < 60)) throw new BodyFitError('REFERENCE_OUT_OF_RANGE');
    const day = age.totalDays;
    const row = findRow(table, day);
    if (!row) throw new BodyFitError('REFERENCE_MISSING', { age: day, unit: 'day' });
    return { l: row[1], m: row[2], s: row[3], basis: row[4] === 'H' ? 'height' : 'length', age: day, unit: 'day' };
  }

  if (group === AGE_GROUPS.SCHOOL) {
    assertTable(table, 'month');
    const months = age.ageInMonths;
    if (!(months >= 60 && months < SCHOOL_AGE_UPPER_MONTHS)) throw new BodyFitError('REFERENCE_OUT_OF_RANGE');
    const low = Math.trunc(months);
    const diff = months - low;
    const lowRow = findRow(table, low);
    if (!lowRow) throw new BodyFitError('REFERENCE_MISSING', { age: low, unit: 'month' });
    if (diff === 0) {
      return { l: lowRow[1], m: lowRow[2], s: lowRow[3], basis: 'height', age: months, unit: 'month' };
    }
    const uppRow = findRow(table, low + 1);
    if (!uppRow) throw new BodyFitError('REFERENCE_MISSING', { age: low + 1, unit: 'month' });
    const lerp = (a, b) => a + diff * (b - a);
    return {
      l: lerp(lowRow[1], uppRow[1]),
      m: lerp(lowRow[2], uppRow[2]),
      s: lerp(lowRow[3], uppRow[3]),
      basis: 'height',
      age: months,
      unit: 'month',
    };
  }

  throw new BodyFitError('REFERENCE_OUT_OF_RANGE');
}

/** Measurement value at a given z-score for LMS parameters (inverse LMS). */
export function lmsValueAtZ(z, l, m, s) {
  if (l === 0) return m * Math.exp(s * z);
  return m * Math.pow(1 + l * s * z, 1 / l);
}

/**
 * LMS z-score.
 *
 *   Z = ((y / M)^L − 1) / (L · S)      (L ≠ 0)
 *   Z = ln(y / M) / S                  (L = 0)
 *
 * With `restricted: true` (default, WHO method for BMI-for-age) z-scores
 * beyond ±3 are recomputed using the distance between SD2 and SD3, as in
 * the WHO Child Growth Standards technical report (ch. 7) and the WHO 2007
 * computation document, so the extreme tails are not distorted by the
 * skewness of the LMS curve.
 */
export function calculateLMSZScore(y, l, m, s, { restricted = true } = {}) {
  if (![y, l, m, s].every(Number.isFinite) || y <= 0 || m <= 0 || s <= 0) {
    throw new BodyFitError('INVALID_RESULT');
  }
  const z = l === 0 ? Math.log(y / m) / s : (Math.pow(y / m, l) - 1) / (l * s);
  if (!Number.isFinite(z)) throw new BodyFitError('INVALID_RESULT');
  if (!restricted) return z;

  if (z > 3) {
    const sd3 = lmsValueAtZ(3, l, m, s);
    const sd23 = sd3 - lmsValueAtZ(2, l, m, s);
    return 3 + (y - sd3) / sd23;
  }
  if (z < -3) {
    const sd3neg = lmsValueAtZ(-3, l, m, s);
    const sd23neg = lmsValueAtZ(-2, l, m, s) - sd3neg;
    return -3 + (y - sd3neg) / sd23neg;
  }
  return z;
}

/** Percentile (0–100) from a z-score via the standard normal CDF. */
export function calculatePercentile(z) {
  if (!Number.isFinite(z)) throw new BodyFitError('INVALID_RESULT');
  return normalCdf(z) * 100;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Rounds half away from zero to `digits` decimals (as WHO tables/software present values). */
export function roundTo(value, digits) {
  const f = 10 ** digits;
  const scaled = Math.abs(value) * f;
  // Small epsilon protects against binary artefacts such as 24.95 → 24.9499999.
  const rounded = Math.floor(scaled + 0.5 + 1e-9) / f;
  return Math.sign(value) * rounded;
}

export const ADULT_CATEGORIES = [
  { key: 'underweight', min: -Infinity, max: 18.5 },
  { key: 'normal', min: 18.5, max: 25 },
  { key: 'overweight', min: 25, max: 30 },
  { key: 'obesity1', min: 30, max: 35 },
  { key: 'obesity2', min: 35, max: 40 },
  { key: 'obesity3', min: 40, max: Infinity },
];

/**
 * WHO adult classification. WHO cut-offs are published to one decimal
 * (18.5, 24.9, 25.0 …), so the BMI is rounded to one decimal before it is
 * classified — the category always agrees with the BMI the user sees.
 */
export function classifyAdultBMI(bmi) {
  if (!Number.isFinite(bmi) || bmi <= 0) throw new BodyFitError('INVALID_RESULT');
  const value = roundTo(bmi, 1);
  const category = ADULT_CATEGORIES.find((c) => value >= c.min && value < c.max);
  return { key: category.key, value };
}

/**
 * WHO BMI-for-age classification for children.
 *
 * 0–5 years (WHO Child Growth Standards):
 *   z < −3 severe wasting · z < −2 wasting · −2 ≤ z ≤ +1 normal ·
 *   z > +1 possible risk of overweight · z > +2 overweight · z > +3 obese
 *
 * 5–19 years (WHO Growth Reference 2007):
 *   z < −3 severe thinness · z < −2 thinness · −2 ≤ z ≤ +1 normal ·
 *   z > +1 overweight · z > +2 obesity
 *
 * Classification uses the z-score rounded to two decimals, as reported by
 * the WHO software.
 */
export function classifyChildBMI(z, group) {
  if (!Number.isFinite(z)) throw new BodyFitError('INVALID_RESULT');
  const zr = roundTo(z, 2);
  if (Math.abs(zr) > IMPLAUSIBLE_Z) return { key: 'implausible', z: zr };

  if (group === AGE_GROUPS.INFANT) {
    if (zr < -3) return { key: 'severeWasting', z: zr };
    if (zr < -2) return { key: 'wasting', z: zr };
    if (zr <= 1) return { key: 'normal', z: zr };
    if (zr <= 2) return { key: 'riskOfOverweight', z: zr };
    if (zr <= 3) return { key: 'overweight', z: zr };
    return { key: 'obese', z: zr };
  }
  if (group === AGE_GROUPS.SCHOOL) {
    if (zr < -3) return { key: 'severeThinness', z: zr };
    if (zr < -2) return { key: 'thinness', z: zr };
    if (zr <= 1) return { key: 'normal', z: zr };
    if (zr <= 2) return { key: 'overweight', z: zr };
    return { key: 'obesity', z: zr };
  }
  throw new BodyFitError('REFERENCE_OUT_OF_RANGE');
}
