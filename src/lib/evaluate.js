// Orchestrates a full BMI evaluation: age → reference group → BMI →
// (for children) LMS z-score, percentile and WHO classification.
// The WHO table loader is injected so this stays testable without a browser.

import {
  AGE_GROUPS,
  BodyFitError,
  IMPLAUSIBLE_Z,
  MEASUREMENT,
  calculateAge,
  calculateBMI,
  calculateLMSZScore,
  calculatePercentile,
  classifyAdultBMI,
  classifyChildBMI,
  getAgeGroup,
  getWHOReference,
  lmsValueAtZ,
  standardizeLengthHeight,
} from './bmi.js';

export const SEXES = ['male', 'female'];

/** Plausibility window for adult BMI; values outside almost always mean a typing error. */
export const ADULT_BMI_PLAUSIBLE = { min: 10, max: 100 };

/**
 * @param {object} input
 * @param {string} input.birthDate     YYYY-MM-DD
 * @param {'male'|'female'} input.sex
 * @param {number} input.heightCm
 * @param {number} input.weightKg
 * @param {'length'|'height'} [input.measurement]  only used under 5 years
 * @param {string} input.referenceDate YYYY-MM-DD (date of measurement)
 * @param {(group: string, sex: string) => Promise<object>} loadTable
 */
export async function evaluateBMI(input, loadTable) {
  const { birthDate, sex, heightCm, weightKg, referenceDate } = input;
  if (!SEXES.includes(sex)) throw new BodyFitError('INVALID_SEX');

  const age = calculateAge(birthDate, referenceDate);
  const group = getAgeGroup(age);

  if (group === AGE_GROUPS.ADULT || group === AGE_GROUPS.GAP) {
    const bmi = calculateBMI(weightKg, heightCm);
    if (bmi < ADULT_BMI_PLAUSIBLE.min || bmi > ADULT_BMI_PLAUSIBLE.max) {
      throw new BodyFitError('IMPLAUSIBLE_BMI', { bmi });
    }
    const base = { group, age, sex, bmi, heightCm, weightKg };
    if (group === AGE_GROUPS.GAP) return base;

    const classification = classifyAdultBMI(bmi);
    const h = heightCm / 100;
    return {
      ...base,
      classification,
      // Weight range that corresponds to WHO "normal" BMI 18.5–24.9 at this height.
      normalWeightRange: { min: 18.5 * h * h, max: 24.9 * h * h },
    };
  }

  // Children and adolescents.
  let usedHeight = heightCm;
  let adjustment = 0;
  let measurement = MEASUREMENT.HEIGHT;
  if (group === AGE_GROUPS.INFANT) {
    measurement = input.measurement;
    const std = standardizeLengthHeight(heightCm, age.totalDays, measurement);
    usedHeight = std.value;
    adjustment = std.adjustment;
  }
  const bmi = calculateBMI(weightKg, usedHeight);

  let table;
  try {
    table = await loadTable(group, sex);
  } catch (err) {
    if (err instanceof BodyFitError) throw err;
    throw new BodyFitError('REFERENCE_MISSING', { cause: err });
  }
  const ref = getWHOReference(table, group, age);
  const z = calculateLMSZScore(bmi, ref.l, ref.m, ref.s);
  const classification = classifyChildBMI(z, group);
  const implausible = Math.abs(classification.z) > IMPLAUSIBLE_Z;

  return {
    group,
    age,
    sex,
    bmi,
    heightCm,
    weightKg,
    usedHeight,
    adjustment,
    measurement,
    reference: ref,
    referenceMeta: { standard: table.standard, source: table.source },
    z,
    percentile: calculatePercentile(z),
    classification,
    implausible,
    // BMI values on the WHO curves for this exact age — for orientation only.
    curve: Object.fromEntries([-3, -2, -1, 0, 1, 2, 3].map((k) => [k, lmsValueAtZ(k, ref.l, ref.m, ref.s)])),
  };
}
