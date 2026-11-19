// Form validation. Returns field → Uzbek message; empty object means valid.

import { MAX_SUPPORTED_YEARS, calculateAge, parseISODate } from './bmi.js';

export const HEIGHT_RANGE = { min: 30, max: 260 }; // cm
export const WEIGHT_RANGE = { min: 0.5, max: 500 }; // kg

/** Parses a user-entered number, accepting both "72.5" and "72,5". */
export function parseDecimal(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

export function validateInput(values, referenceDate) {
  const errors = {};

  if (!values.birthDate) {
    errors.birthDate = "Tug'ilgan sanani kiriting.";
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

  const height = parseDecimal(values.height);
  if (values.height === '' || values.height == null) {
    errors.height = "Bo'yni kiriting.";
  } else if (!Number.isFinite(height)) {
    errors.height = "Bo'y faqat raqam bo'lishi kerak (masalan, 170 yoki 170,5).";
  } else if (height < HEIGHT_RANGE.min || height > HEIGHT_RANGE.max) {
    errors.height = `Bo'y ${HEIGHT_RANGE.min}–${HEIGHT_RANGE.max} sm oralig'ida bo'lishi kerak.`;
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
