// All user-facing text (Uzbek, Latin script) and display formatting.

import { AGE_GROUPS, roundTo } from './bmi.js';

/** Uzbek number format: comma as decimal separator. */
export function formatNumber(value, digits = 1) {
  const r = roundTo(value, digits);
  const s = (Object.is(r, -0) ? 0 : r).toFixed(digits).replace('.', ',');
  return s.replace(/^-/, '−');
}

export function formatSigned(value, digits = 2) {
  const s = formatNumber(value, digits);
  return value > 0 && !s.startsWith('−') && roundTo(value, digits) !== 0 ? `+${s}` : s;
}

export function formatPercentile(p) {
  if (p < 0.1) return '<0,1';
  if (p > 99.9) return '>99,9';
  return formatNumber(p, 1);
}

export function formatAge(age) {
  const { years, months, days } = age;
  if (years >= 5) return months ? `${years} yosh ${months} oy` : `${years} yosh`;
  const parts = [];
  if (years) parts.push(`${years} yosh`);
  if (months) parts.push(`${months} oy`);
  if (days || parts.length === 0) parts.push(`${days} kun`);
  return parts.join(' ');
}

export const GROUP_LABELS = {
  [AGE_GROUPS.INFANT]: {
    title: '0–5 yosh',
    standard: "JSST bolalar o'sish standartlari (2006)",
    standardShort: 'JSST 2006 · 0–5 yosh',
  },
  [AGE_GROUPS.SCHOOL]: {
    title: '5–19 yosh',
    standard: "JSST 5–19 yoshlilar uchun o'sish referensi (2007)",
    standardShort: 'JSST 2007 · 5–19 yosh',
  },
  [AGE_GROUPS.ADULT]: {
    title: '20 yosh va undan katta',
    standard: 'JSST kattalar uchun BMI tasnifi',
    standardShort: 'JSST · kattalar',
  },
  [AGE_GROUPS.GAP]: {
    title: '19 yosh',
    standard: "Mos JSST referensi mavjud emas",
    standardShort: 'Referens yo‘q',
  },
};

// tone: used for colour coding — 'ok' | 'watch' | 'warn' | 'alert'
export const CATEGORY_LABELS = {
  adult: {
    underweight: { label: 'Vazn yetishmovchiligi', range: '18,5 dan past', tone: 'warn' },
    normal: { label: 'Normal vazn', range: '18,5 – 24,9', tone: 'ok' },
    overweight: { label: 'Ortiqcha vazn', range: '25,0 – 29,9', tone: 'watch' },
    obesity1: { label: 'I darajali semizlik', range: '30,0 – 34,9', tone: 'warn' },
    obesity2: { label: 'II darajali semizlik', range: '35,0 – 39,9', tone: 'alert' },
    obesity3: { label: 'III darajali semizlik', range: '40,0 va undan yuqori', tone: 'alert' },
  },
  [AGE_GROUPS.INFANT]: {
    severeWasting: { label: "Og'ir darajadagi ozg'inlik", range: 'z < −3', tone: 'alert' },
    wasting: { label: "Ozg'inlik", range: '−3 ≤ z < −2', tone: 'warn' },
    normal: { label: 'Normal', range: '−2 ≤ z ≤ +1', tone: 'ok' },
    riskOfOverweight: { label: 'Ortiqcha vazn xavfi ehtimoli', range: '+1 < z ≤ +2', tone: 'watch' },
    overweight: { label: 'Ortiqcha vazn', range: '+2 < z ≤ +3', tone: 'warn' },
    obese: { label: 'Semizlik', range: 'z > +3', tone: 'alert' },
    implausible: { label: 'Ishonchsiz natija', range: '|z| > 5', tone: 'alert' },
  },
  [AGE_GROUPS.SCHOOL]: {
    severeThinness: { label: "Og'ir darajadagi ozg'inlik", range: 'z < −3', tone: 'alert' },
    thinness: { label: "Ozg'inlik", range: '−3 ≤ z < −2', tone: 'warn' },
    normal: { label: 'Normal', range: '−2 ≤ z ≤ +1', tone: 'ok' },
    overweight: { label: 'Ortiqcha vazn', range: '+1 < z ≤ +2', tone: 'watch' },
    obesity: { label: 'Semizlik', range: 'z > +2', tone: 'alert' },
    implausible: { label: 'Ishonchsiz natija', range: '|z| > 5', tone: 'alert' },
  },
};

export const CATEGORY_EXPLANATIONS = {
  adult: {
    underweight:
      "BMI JSST belgilagan normal oraliqdan (18,5–24,9) past. Bu vazn bo'yga nisbatan kam ekanini ko'rsatadi; sababini aniqlash uchun shifokor bilan maslahatlashish mumkin.",
    normal: "BMI JSST belgilagan normal oraliqda (18,5–24,9).",
    overweight: "BMI JSST bo'yicha ortiqcha vazn oralig'ida (25,0–29,9).",
    obesity1: "BMI JSST bo'yicha I darajali semizlik oralig'ida (30,0–34,9).",
    obesity2: "BMI JSST bo'yicha II darajali semizlik oralig'ida (35,0–39,9).",
    obesity3: "BMI JSST bo'yicha III darajali semizlik oralig'ida (40,0 va undan yuqori).",
  },
  child: {
    normal: "Bolaning BMI ko'rsatkichi shu yosh va jinsdagi JSST referens ma'lumotlariga ko'ra normal oraliqda.",
    severeWasting: "BMI-yoshga z-score −3 dan past. JSST bo'yicha bu og'ir darajadagi ozg'inlikka to'g'ri keladi.",
    wasting: "BMI-yoshga z-score −3 va −2 oralig'ida. JSST bo'yicha bu ozg'inlikka to'g'ri keladi.",
    riskOfOverweight:
      "BMI-yoshga z-score +1 dan yuqori. JSST bo'yicha bu ortiqcha vazn xavfi ehtimolini bildiradi va kuzatib borishni talab qiladi.",
    overweight: "BMI-yoshga z-score JSST bo'yicha ortiqcha vazn chegarasidan yuqori.",
    obese: "BMI-yoshga z-score +3 dan yuqori. JSST bo'yicha bu semizlikka to'g'ri keladi.",
    severeThinness: "BMI-yoshga z-score −3 dan past. JSST bo'yicha bu og'ir darajadagi ozg'inlikka to'g'ri keladi.",
    thinness: "BMI-yoshga z-score −3 va −2 oralig'ida. JSST bo'yicha bu ozg'inlikka to'g'ri keladi.",
    obesity: "BMI-yoshga z-score +2 dan yuqori. JSST bo'yicha bu semizlikka to'g'ri keladi.",
    implausible:
      "Z-score ±5 dan tashqarida. JSST bunday qiymatni ehtimoliy o'lchash yoki kiritish xatosi deb belgilaydi, shuning uchun tasnif berilmadi. Bo'y, vazn va tug'ilgan sanani qayta tekshiring.",
  },
};

export const ERROR_MESSAGES = {
  INVALID_BIRTH_DATE: "Tug'ilgan sana noto'g'ri.",
  INVALID_REFERENCE_DATE: "Joriy sanani aniqlab bo'lmadi. Qurilmangiz sanasini tekshiring.",
  FUTURE_BIRTH_DATE: "Tug'ilgan sana kelajakdagi sana bo'lishi mumkin emas.",
  UNSUPPORTED_AGE: "Bu yosh uchun hisoblash qo'llab-quvvatlanmaydi.",
  INVALID_SEX: 'Jinsni tanlang.',
  INVALID_HEIGHT: "Bo'y qiymati noto'g'ri.",
  INVALID_WEIGHT: "Vazn qiymati noto'g'ri.",
  INVALID_MEASUREMENT: "Bo'y qanday o'lchanganini tanlang (yotgan yoki tik turgan holda).",
  IMPLAUSIBLE_BMI:
    "Hisoblangan BMI inson uchun real oraliqdan tashqarida. Bo'y santimetrda, vazn kilogrammda kiritilganini tekshiring.",
  INVALID_RESULT: "Hisoblash natijasi yaroqsiz chiqdi. Kiritilgan qiymatlarni tekshiring.",
  REFERENCE_MISSING:
    "JSST referens ma'lumotlarini yuklab bo'lmadi. Ushbu yosh guruhi uchun natija ko'rsatilmaydi. Sahifani yangilab, qayta urinib ko'ring.",
  REFERENCE_INVALID:
    "JSST referens fayli buzilgan yoki kutilgan formatda emas. Noto'g'ri natija ko'rsatmaslik uchun hisoblash to'xtatildi.",
  REFERENCE_MISMATCH: "Yosh guruhiga mos bo'lmagan referens jadvali tanlandi. Hisoblash to'xtatildi.",
  REFERENCE_OUT_OF_RANGE: "Bu yosh tanlangan JSST referensi qamrovidan tashqarida.",
  UNKNOWN: "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.",
};
