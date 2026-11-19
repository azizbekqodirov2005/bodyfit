// Converts the official WHO LMS tables in data-raw/ into the JSON files used
// by the app (public/data/*.json). Values are copied verbatim — nothing is
// interpolated, rounded, or generated here.
//
// Usage: npm run data:build

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCES = {
  '0-5': {
    file: 'data-raw/who-2006-bmianthro.txt',
    standard: 'WHO Child Growth Standards (2006)',
    indicator: 'BMI-for-age',
    ageUnit: 'day',
    officialPage: 'https://www.who.int/tools/child-growth-standards/standards/body-mass-index-for-age-bmi-for-age',
    upstream: {
      repository: 'https://github.com/WorldHealthOrganization/anthro',
      path: 'data-raw/growthstandards/bmianthro.txt',
      commit: 'b776d8a12b1c97369c748b561159fd2ec4f4db58',
      packageVersion: 'anthro 1.1.0.9000',
    },
    notes:
      "Daily LMS values (age in completed days, 0–1826). Column 'loh' = L (recumbent length, < 731 days) or H (standing height, ≥ 731 days).",
  },
  '5-19': {
    file: 'data-raw/who-2007-bfawho2007.txt',
    standard: 'WHO Growth Reference 2007 (5–19 years)',
    indicator: 'BMI-for-age',
    ageUnit: 'month',
    officialPage: 'https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age',
    upstream: {
      repository: 'https://github.com/WorldHealthOrganization/anthroplus',
      path: 'data-raw/growthstandards/bfawho2007.txt',
      commit: '7cfcdb39026e9a55de55732bc3cf14c82261bcf7',
      packageVersion: 'anthroplus 1.1.0.9000',
    },
    notes:
      'Monthly LMS values (60–229 months). WHO computes LMS for non-integer ages by linear interpolation between adjacent whole months (anthroplus zscore_indicator; WHO 2007 macro).',
  },
};

const SEX = { 1: 'boys', 2: 'girls' };

for (const [group, src] of Object.entries(SOURCES)) {
  const raw = readFileSync(join(root, src.file), 'utf8');
  const sha256 = createHash('sha256').update(raw).digest('hex');
  const lines = raw.trim().split(/\r?\n/);
  const header = lines[0].split('\t').map((h) => h.trim());
  const idx = (name) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`${src.file}: missing column "${name}"`);
    return i;
  };
  const cols = { sex: idx('sex'), age: idx('age'), l: idx('l'), m: idx('m'), s: idx('s') };
  const lohIdx = header.indexOf('loh');

  const bySex = { 1: [], 2: [] };
  for (const line of lines.slice(1)) {
    const parts = line.split('\t').map((p) => p.trim());
    const sex = Number(parts[cols.sex]);
    if (!(sex in bySex)) throw new Error(`${src.file}: unexpected sex value "${parts[cols.sex]}"`);
    const row = [Number(parts[cols.age]), Number(parts[cols.l]), Number(parts[cols.m]), Number(parts[cols.s])];
    if (row.some((v) => !Number.isFinite(v))) throw new Error(`${src.file}: non-numeric value in "${line}"`);
    if (lohIdx !== -1) row.push(parts[lohIdx]);
    bySex[sex].push(row);
  }

  for (const sex of [1, 2]) {
    const rows = bySex[sex].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] !== rows[i - 1][0] + 1) {
        throw new Error(`${src.file}: gap in ages for sex ${sex} after ${rows[i - 1][0]}`);
      }
    }
    const out = {
      indicator: src.indicator,
      standard: src.standard,
      sex: SEX[sex],
      ageUnit: src.ageUnit,
      ageMin: rows[0][0],
      ageMax: rows[rows.length - 1][0],
      columns: lohIdx !== -1 ? ['age', 'l', 'm', 's', 'loh'] : ['age', 'l', 'm', 's'],
      source: {
        officialPage: src.officialPage,
        ...src.upstream,
        rawFile: src.file,
        rawFileSha256: sha256,
        notes: src.notes,
      },
      rows,
    };
    const target = join(root, 'public/data', `who-${group}-${SEX[sex]}.json`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(out) + '\n');
    console.log(`${target}: ${rows.length} rows (${out.ageMin}–${out.ageMax} ${src.ageUnit}s)`);
  }
}
