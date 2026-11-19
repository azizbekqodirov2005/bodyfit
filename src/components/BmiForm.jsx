import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Lock, RotateCcw } from 'lucide-react';
import { HEIGHT_FROM_DAY, MAX_SUPPORTED_YEARS, calculateAge, parseISODate, todayISO } from '../lib/bmi.js';
import { validateInput } from '../lib/validation.js';

const EMPTY = { birthDate: '', sex: '', height: '', weight: '', measurement: '' };

function minBirthDate(today) {
  const [y, m, d] = today.split('-');
  return `${Number(y) - MAX_SUPPORTED_YEARS + 1}-${m}-${d}`;
}

export default function BmiForm({ onSubmit, onChange, onReset, busy }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touchedMeasurement, setTouchedMeasurement] = useState(false);
  const today = todayISO();
  const fieldRefs = useRef({});

  // Age (for showing the length/height choice to children under 5).
  const age = useMemo(() => {
    const birth = parseISODate(values.birthDate);
    if (!birth || birth.dayNumber > parseISODate(today).dayNumber) return null;
    return calculateAge(values.birthDate, today);
  }, [values.birthDate, today]);
  const underFive = age !== null && age.ageInMonths < 60;

  // Default the measurement method to what WHO expects for the age, unless the user chose.
  useEffect(() => {
    if (!underFive) return;
    if (!touchedMeasurement) {
      const expected = age.totalDays < HEIGHT_FROM_DAY ? 'length' : 'height';
      setValues((v) => (v.measurement === expected ? v : { ...v, measurement: expected }));
    }
  }, [underFive, age, touchedMeasurement]);

  const update = (field) => (e) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    if (field === 'measurement') setTouchedMeasurement(true);
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
    onChange();
  };

  const submit = (e) => {
    e.preventDefault();
    const found = validateInput(values, today);
    if (underFive && values.measurement !== 'length' && values.measurement !== 'height') {
      found.measurement = "Bo'y qanday o'lchanganini tanlang.";
    }
    setErrors(found);
    const first = ['birthDate', 'sex', 'measurement', 'height', 'weight'].find((k) => found[k]);
    if (first) {
      fieldRefs.current[first]?.focus();
      return;
    }
    onSubmit({ ...values, measurement: underFive ? values.measurement : undefined });
  };

  const reset = () => {
    setValues(EMPTY);
    setErrors({});
    setTouchedMeasurement(false);
    onReset();
  };

  const err = (field) =>
    errors[field] ? (
      <p className="field__error" id={`${field}-error`} role="alert">
        {errors[field]}
      </p>
    ) : null;
  const a11y = (field) => ({
    'aria-invalid': errors[field] ? 'true' : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  });

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <div className="card__head">
        <h2>O'lchov ma'lumotlari</h2>
        <p className="card__sub">Barcha maydonlar majburiy</p>
      </div>

      <div className="field">
        <label htmlFor="birthDate">Tug'ilgan sana</label>
        <input
          id="birthDate"
          type="date"
          ref={(el) => (fieldRefs.current.birthDate = el)}
          value={values.birthDate}
          min={minBirthDate(today)}
          max={today}
          onChange={update('birthDate')}
          {...a11y('birthDate')}
        />
        {err('birthDate')}
      </div>

      <fieldset className="field">
        <legend>Jins</legend>
        <div className="segmented" role="radiogroup" aria-describedby={errors.sex ? 'sex-error' : undefined}>
          {[
            ['male', 'Erkak'],
            ['female', 'Ayol'],
          ].map(([value, label], i) => (
            <label key={value} className={`segmented__option${values.sex === value ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="sex"
                value={value}
                checked={values.sex === value}
                onChange={update('sex')}
                ref={i === 0 ? (el) => (fieldRefs.current.sex = el) : undefined}
              />
              {label}
            </label>
          ))}
        </div>
        {err('sex')}
      </fieldset>

      {underFive && (
        <fieldset className="field">
          <legend>Bo'y qanday o'lchangan?</legend>
          <div className="segmented segmented--stack" role="radiogroup">
            {[
              ['length', 'Yotgan holda (uzunlik)'],
              ['height', 'Tik turgan holda'],
            ].map(([value, label], i) => (
              <label key={value} className={`segmented__option${values.measurement === value ? ' is-active' : ''}`}>
                <input
                  type="radio"
                  name="measurement"
                  value={value}
                  checked={values.measurement === value}
                  onChange={update('measurement')}
                  ref={i === 0 ? (el) => (fieldRefs.current.measurement = el) : undefined}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="field__hint">
            JSST 2 yoshgacha bo'yni yotgan holda, 2 yoshdan boshlab tik turgan holda o'lchaydi. Boshqa usul tanlansa,
            JSST qoidasiga ko'ra 0,7 sm tuzatish kiritiladi.
          </p>
          {err('measurement')}
        </fieldset>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="height">Bo'y</label>
          <div className="input-unit">
            <input
              id="height"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="170"
              ref={(el) => (fieldRefs.current.height = el)}
              value={values.height}
              onChange={update('height')}
              {...a11y('height')}
            />
            <span aria-hidden="true">sm</span>
          </div>
          {err('height')}
        </div>
        <div className="field">
          <label htmlFor="weight">Vazn</label>
          <div className="input-unit">
            <input
              id="weight"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="65,5"
              ref={(el) => (fieldRefs.current.weight = el)}
              value={values.weight}
              onChange={update('weight')}
              {...a11y('weight')}
            />
            <span aria-hidden="true">kg</span>
          </div>
          {err('weight')}
        </div>
      </div>

      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <Calculator size={18} aria-hidden="true" />
          {busy ? 'Hisoblanmoqda…' : 'Hisoblash'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" />
          Tozalash
        </button>
      </div>

      <p className="privacy">
        <Lock size={14} aria-hidden="true" />
        Ma'lumotlaringiz faqat shu qurilmada hisoblanadi, hech qayerga yuborilmaydi va saqlanmaydi.
      </p>
    </form>
  );
}
