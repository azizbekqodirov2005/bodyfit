import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTable } from '../src/lib/whoData.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function readJSON(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), 'utf8'));
}

export function readText(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

const FILE_SEX = { male: 'boys', female: 'girls' };

/** Loads the real WHO tables from public/data (same files the app uses). */
export async function loadTableFromDisk(group, sex) {
  return validateTable(readJSON(`public/data/who-${group}-${FILE_SEX[sex]}.json`), group);
}

/** Minimal CSV parser for the WHO fixture (quoted strings, no embedded commas). */
export function parseCSV(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',').map((c) => c.replace(/"/g, ''));
  return lines.map((line) => {
    const cells = line.split(',').map((c) => c.replace(/"/g, ''));
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}
