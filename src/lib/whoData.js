// Loads the official WHO LMS tables from /public/data on demand and caches them
// in memory for the session. Nothing about the user is sent anywhere: these
// are static files requested from the same origin.

import { BodyFitError } from './bmi.js';

const FILE_SEX = { male: 'boys', female: 'girls' };
const cache = new Map();

export function validateTable(table, group) {
  const unit = group === '0-5' ? 'day' : 'month';
  const ok =
    table &&
    table.indicator === 'BMI-for-age' &&
    table.ageUnit === unit &&
    Array.isArray(table.rows) &&
    table.rows.length > 0 &&
    table.rows.every(
      (r, i) =>
        Array.isArray(r) &&
        r[0] === table.ageMin + i &&
        Number.isFinite(r[1]) &&
        Number.isFinite(r[2]) &&
        r[2] > 0 &&
        Number.isFinite(r[3]) &&
        r[3] > 0,
    );
  if (!ok) throw new BodyFitError('REFERENCE_INVALID');
  return table;
}

export function loadWHOTable(group, sex) {
  const fileSex = FILE_SEX[sex];
  if (!fileSex || (group !== '0-5' && group !== '5-19')) {
    return Promise.reject(new BodyFitError('REFERENCE_MISSING'));
  }
  const key = `${group}-${fileSex}`;
  if (!cache.has(key)) {
    const url = `${import.meta.env.BASE_URL}data/who-${key}.json`;
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new BodyFitError('REFERENCE_MISSING');
        return res.json();
      })
      .then((json) => validateTable(json, group))
      .catch((err) => {
        cache.delete(key);
        throw err instanceof BodyFitError ? err : new BodyFitError('REFERENCE_MISSING', { cause: err });
      });
    cache.set(key, promise);
  }
  return cache.get(key);
}
