// Form validation. Returns field → Uzbek message; empty object means valid.

import { MAX_SUPPORTED_YEARS, calculateAge, parseISODate } from './bmi.js';

export const HEIGHT_RANGE = { min: 30, max: 260 }; // cm
export const WEIGHT_RANGE = { min: 0.5, max: 500 }; // kg

/** Parses a user-entered number, accepting both "72.5" and "72,5". */
export function parseDecimal(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d*)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

/**
 * Keeps only what a decimal number may contain while the user types:
 * digits and a single separator ("," or "."), at most `maxInt` integer digits
 * and `maxDecimals` fractional digits. Letters and other symbols are dropped.
 */
export function sanitizeDecimalInput(raw, { maxInt = 3, maxDecimals = 2 } = {}) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const sepIndex = cleaned.search(/[.,]/);
  if (sepIndex === -1) return cleaned.slice(0, maxInt);
  const intPart = cleaned.slice(0, sepIndex).slice(0, maxInt);
  const sep = cleaned[sepIndex];
  const fracPart = cleaned
    .slice(sepIndex + 1)
    .replace(/[.,]/g, '')
    .slice(0, maxDecimals);
  return `${intPart || '0'}${sep}${fracPart}`;
}

/** Height entered between these values is read as metres (e.g. 1,80 → 180 sm). */
export const METRE_INPUT_RANGE = { min: 0.3, max: 2.6 };

/**
 * Converts the height field to centimetres. People often type metres
 * ("1,80", "1.20"); a human height in centimetres is never below 30, so any
 * value from 0,3 to 2,6 is unambiguous and is converted from metres.
 */
export function normalizeHeight(value) {
  const n = parseDecimal(value);
  if (!Number.isFinite(n)) return { cm: NaN, fromMetres: false };
  if (n >= METRE_INPUT_RANGE.min && n <= METRE_INPUT_RANGE.max) {
    return { cm: Math.round(n * 10000) / 100, fromMetres: true };
  }
  return { cm: n, fromMetres: false };
}

export function validateInput(values, referenceDate) {
  const errors = {};

  if (!values.birthDate) {
    errors.birthDate = "Tug'ilgan sanani tanlang (kun, oy va yil).";
  } else if (!parseISODate(values.birthDate)) {
    errors.birthDate = "Tug'ilgan sana noto'g'ri formatda.";
  } else {
    const birth = parseISODate(values.birthDate);
    const ref = parseISODate(referenceDate);
    if (birth.dayNumber > ref.dayNumber) {
      errors.birthDate = "Tug'ilgan sana kelajakdagi sana bo'lishi mumkin emas.";
    } else if (calculateAge(values.birthDate, referenceDate).years >= MAX_SUPPORTED_YEARS) {
      errors.birthDate = `${MAX_SUPPORTED_YEARS} yosh va undan kattalar uchun hisoblash qo'llab-quvvatlanmaydi. Sanani tekshiring.`;
    }
  }

  if (values.sex !== 'male' && values.sex !== 'female') {
    errors.sex = 'Jinsni tanlang.';
  }

  const height = normalizeHeight(values.height).cm;
  if (values.height === '' || values.height == null) {
    errors.height = "Bo'yni kiriting.";
  } else if (!Number.isFinite(height)) {
    errors.height = "Bo'y faqat raqam bo'lishi kerak (masalan, 170 yoki 1,70).";
  } else if (height < HEIGHT_RANGE.min || height > HEIGHT_RANGE.max) {
    errors.height = `Bo'yni santimetrda (${HEIGHT_RANGE.min}–${HEIGHT_RANGE.max}) yoki metrda (0,3–2,6) kiriting.`;
  }

  const weight = parseDecimal(values.weight);
  if (values.weight === '' || values.weight == null) {
    errors.weight = 'Vaznni kiriting.';
  } else if (!Number.isFinite(weight)) {
    errors.weight = "Vazn faqat raqam bo'lishi kerak (masalan, 65 yoki 65,4).";
  } else if (weight < WEIGHT_RANGE.min || weight > WEIGHT_RANGE.max) {
    errors.weight = `Vazn ${WEIGHT_RANGE.min.toString().replace('.', ',')}–${WEIGHT_RANGE.max} kg oralig'ida bo'lishi kerak.`;
  }

  return errors;
}
