import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MAX_SUPPORTED_YEARS, calculateAge, parseISODate } from '../lib/bmi.js';
import { formatAge } from '../lib/i18n.js';

export const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

const pad = (n) => String(n).padStart(2, '0');
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function splitISO(value) {
  const d = parseISODate(value);
  return d ? { day: String(d.day), month: String(d.month), year: String(d.year) } : { day: '', month: '', year: '' };
}

/**
 * Date of birth picker: three Uzbek-labelled selects (kun / oy / yil).
 * Works the same on every browser and device, never shows a future date,
 * and reports a complete ISO date (YYYY-MM-DD) or '' while incomplete.
 */
export default function DateField({ id, value, today, onChange, invalid, describedBy, firstRef }) {
  const [parts, setParts] = useState(() => splitISO(value));
  const now = parseISODate(today);

  // Follow external resets (e.g. the "Tozalash" button).
  useEffect(() => {
    if (value === '') setParts((p) => (p.day || p.month || p.year ? { day: '', month: '', year: '' } : p));
  }, [value]);

  const set = (field) => (e) => {
    const next = { ...parts, [field]: e.target.value };
    const y = Number(next.year);
    const m = Number(next.month);
    // Keep the day valid for the chosen month/year (e.g. 31 → 30, 29 Feb → 28).
    if (next.day && m && y) {
      const max = daysInMonth(y, m);
      if (Number(next.day) > max) next.day = String(max);
    }
    // Never allow a date after today.
    if (y === now.year && m > now.month) next.month = String(now.month);
    if (y === now.year && Number(next.month) === now.month && Number(next.day) > now.day) next.day = String(now.day);
    setParts(next);
    const complete = next.day && next.month && next.year;
    onChange(complete ? `${next.year}-${pad(next.month)}-${pad(next.day)}` : '');
  };

  const year = Number(parts.year);
  const month = Number(parts.month);
  const maxDay = month && year ? daysInMonth(year, month) : month ? daysInMonth(2000, month) : 31;
  const years = Array.from({ length: MAX_SUPPORTED_YEARS }, (_, i) => now.year - i);

  const valid = parseISODate(value);
  const age = valid && valid.dayNumber <= now.dayNumber ? calculateAge(value, today) : null;

  const common = {
    'aria-invalid': invalid ? 'true' : undefined,
    'aria-describedby': describedBy,
  };

  return (
    <div className="datefield">
      <div className="datefield__row" role="group" aria-labelledby={`${id}-label`}>
        <div className="select">
          <select id={id} ref={firstRef} value={parts.day} onChange={set('day')} aria-label="Kun" {...common}>
            <option value="">Kun</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d} disabled={year === now.year && month === now.month && d > now.day}>
                {d}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
        <div className="select">
          <select value={parts.month} onChange={set('month')} aria-label="Oy" {...common}>
            <option value="">Oy</option>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1} disabled={year === now.year && i + 1 > now.month}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
        <div className="select">
          <select value={parts.year} onChange={set('year')} aria-label="Yil" {...common}>
            <option value="">Yil</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
      </div>
      {age && (
        <p className="datefield__age">
          Yosh: <strong>{formatAge(age)}</strong>
        </p>
      )}
    </div>
  );
}
