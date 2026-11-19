import { AlertTriangle, Info, LineChart, Loader2 } from 'lucide-react';
import { AGE_GROUPS, roundTo } from '../lib/bmi.js';
import {
  CATEGORY_EXPLANATIONS,
  CATEGORY_LABELS,
  GROUP_LABELS,
  formatAge,
  formatNumber,
  formatPercentile,
  formatSigned,
} from '../lib/i18n.js';

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function Scale({ segments, domain, marker, ticks, markerLabel, caption }) {
  const [lo, hi] = domain;
  const pct = (v) => ((clamp(v, lo, hi) - lo) / (hi - lo)) * 100;
  const offScale = marker < lo || marker > hi;
  return (
    <figure className="scale">
      <figcaption className="scale__caption">{caption}</figcaption>
      <div className="scale__track" role="img" aria-label={`${caption}: ${markerLabel}`}>
        {segments.map((s) => (
          <div
            key={s.key}
            className={`scale__seg tone-${s.tone}${s.active ? ' is-active' : ''}`}
            style={{ left: `${pct(s.from)}%`, width: `${pct(s.to) - pct(s.from)}%` }}
            title={s.label}
          />
        ))}
        <div className={`scale__marker${offScale ? ' is-off' : ''}`} style={{ left: `${pct(marker)}%` }}>
          <span className="scale__bubble">{markerLabel}</span>
        </div>
      </div>
      <div className="scale__ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.value} style={{ left: `${pct(t.value)}%` }}>
            {t.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

function AdultScale({ bmi, activeKey }) {
  const labels = CATEGORY_LABELS.adult;
  const bounds = [
    ['underweight', 15, 18.5],
    ['normal', 18.5, 25],
    ['overweight', 25, 30],
    ['obesity1', 30, 35],
    ['obesity2', 35, 40],
    ['obesity3', 40, 45],
  ];
  return (
    <Scale
      caption="JSST kattalar BMI shkalasi (kg/m²)"
      domain={[15, 45]}
      marker={roundTo(bmi, 1)}
      markerLabel={formatNumber(bmi, 1)}
      segments={bounds.map(([key, from, to]) => ({ key, from, to, tone: labels[key].tone, label: labels[key].label, active: key === activeKey }))}
      ticks={[18.5, 25, 30, 35, 40].map((v) => ({ value: v, label: formatNumber(v, 1) }))}
    />
  );
}

function ChildScale({ z, group, activeKey }) {
  const labels = CATEGORY_LABELS[group];
  const bounds =
    group === AGE_GROUPS.INFANT
      ? [
          ['severeWasting', -4, -3],
          ['wasting', -3, -2],
          ['normal', -2, 1],
          ['riskOfOverweight', 1, 2],
          ['overweight', 2, 3],
          ['obese', 3, 4],
        ]
      : [
          ['severeThinness', -4, -3],
          ['thinness', -3, -2],
          ['normal', -2, 1],
          ['overweight', 1, 2],
          ['obesity', 2, 4],
        ];
  return (
    <Scale
      caption="BMI-yoshga z-score (JSST)"
      domain={[-4, 4]}
      marker={z}
      markerLabel={formatSigned(z, 2)}
      segments={bounds.map(([key, from, to]) => ({ key, from, to, tone: labels[key].tone, label: labels[key].label, active: key === activeKey }))}
      ticks={[-3, -2, -1, 0, 1, 2, 3].map((v) => ({ value: v, label: v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0' }))}
    />
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>
        {value}
        {hint && <span className="metric__hint">{hint}</span>}
      </dd>
    </div>
  );
}

function Notices({ child }) {
  return (
    <div className="notice">
      <Info size={16} aria-hidden="true" />
      <div>
        <p>
          BMI — skrining ko'rsatkichi, tibbiy tashxis emas. U tana yog'i miqdorini bevosita o'lchamaydi.
          {child && " Bolalarda natija o'sish dinamikasi bilan birga baholanadi."}
        </p>
        <p>
          Homiladorlik, juda rivojlangan mushak massasi, shishlar (edema) va ayrim kasalliklar BMI talqiniga ta'sir qiladi.
          Bunday hollarda natijani shifokor bilan muhokama qiling.
        </p>
      </div>
    </div>
  );
}

function AdultResult({ result }) {
  const cat = CATEGORY_LABELS.adult[result.classification.key];
  return (
    <>
      <div className="headline">
        <div>
          <p className="headline__label">Tana massasi indeksi</p>
          <p className="headline__value">
            {formatNumber(result.bmi, 1)} <span>kg/m²</span>
          </p>
        </div>
        <span className={`pill tone-${cat.tone}`}>{cat.label}</span>
      </div>
      <p className="explain">{CATEGORY_EXPLANATIONS.adult[result.classification.key]}</p>
      <AdultScale bmi={result.bmi} activeKey={result.classification.key} />
      <dl className="metrics">
        <Metric label="Yosh" value={formatAge(result.age)} />
        <Metric label="Bo'y" value={`${formatNumber(result.heightCm, 1)} sm`} />
        <Metric label="Vazn" value={`${formatNumber(result.weightKg, 1)} kg`} />
        <Metric
          label="Normal BMI uchun vazn"
          value={`${formatNumber(result.normalWeightRange.min, 1)} – ${formatNumber(result.normalWeightRange.max, 1)} kg`}
          hint="Shu bo'y uchun BMI 18,5–24,9"
        />
      </dl>
      <Notices />
    </>
  );
}

function ChildResult({ result }) {
  const { group, classification } = result;
  const cat = CATEGORY_LABELS[group][classification.key];
  const curveKeys = group === AGE_GROUPS.INFANT ? [-2, 0, 1, 2, 3] : [-2, 0, 1, 2];
  const curveLabel = (k) => (k === 0 ? 'Mediana' : `${k > 0 ? '+' : '−'}${Math.abs(k)} SD`);
  const refAge =
    result.reference.unit === 'day'
      ? `${result.reference.age}-kun`
      : `${formatNumber(result.reference.age, 2)} oy`;

  return (
    <>
      {result.implausible && (
        <div className="alert" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>{CATEGORY_EXPLANATIONS.child.implausible}</p>
        </div>
      )}
      <div className="headline">
        <div>
          <p className="headline__label">Tana massasi indeksi</p>
          <p className="headline__value">
            {formatNumber(result.bmi, 1)} <span>kg/m²</span>
          </p>
        </div>
        <span className={`pill tone-${cat.tone}`}>{cat.label}</span>
      </div>
      {!result.implausible && <p className="explain">{CATEGORY_EXPLANATIONS.child[classification.key]}</p>}

      {!result.implausible && (
        <dl className="metrics metrics--key">
          <Metric label="Z-score" value={formatSigned(classification.z, 2)} />
          <Metric label="Persentil" value={formatPercentile(result.percentile)} hint="Tengdoshlarning shuncha foizi BMI'si pastroq" />
          <Metric label="JSST tasnifi" value={cat.label} hint={cat.range} />
        </dl>
      )}

      {!result.implausible && <ChildScale z={classification.z} group={group} activeKey={classification.key} />}

      <dl className="metrics">
        <Metric label="Yosh" value={formatAge(result.age)} />
        <Metric label="Referens yosh guruhi" value={GROUP_LABELS[group].title} hint={refAge} />
        <Metric
          label="Bo'y"
          value={`${formatNumber(result.heightCm, 1)} sm`}
          hint={
            result.adjustment
              ? `Hisobda ${formatNumber(result.usedHeight, 1)} sm (JSST: ${formatSigned(result.adjustment, 1)} sm)`
              : group === AGE_GROUPS.INFANT
                ? result.measurement === 'length'
                  ? 'Yotgan holda'
                  : 'Tik turgan holda'
                : undefined
          }
        />
        <Metric label="Vazn" value={`${formatNumber(result.weightKg, 1)} kg`} />
      </dl>

      {!result.implausible && (
        <div className="curves">
          <p className="curves__title">Shu yosh va jins uchun JSST egri chiziqlari (BMI, kg/m²)</p>
          <div className="curves__grid">
            {curveKeys.map((k) => (
              <div key={k}>
                <span>{curveLabel(k)}</span>
                <strong>{formatNumber(result.curve[k], 1)}</strong>
              </div>
            ))}
          </div>
          <p className="curves__note">
            Bu qiymatlar ma'lumot uchun berilgan. Bolalar uchun yagona "ideal vazn" mavjud emas.
          </p>
        </div>
      )}
      <Notices child />
    </>
  );
}

function GapResult({ result }) {
  return (
    <>
      <div className="headline">
        <div>
          <p className="headline__label">Tana massasi indeksi</p>
          <p className="headline__value">
            {formatNumber(result.bmi, 1)} <span>kg/m²</span>
          </p>
        </div>
        <span className="pill tone-neutral">Tasnif berilmadi</span>
      </div>
      <div className="alert alert--info">
        <Info size={18} aria-hidden="true" />
        <p>
          JSSTning 5–19 yoshlilar uchun BMI referensi 19 yoshga (228 oy) qadar amal qiladi, kattalar tasnifi esa ushbu
          ilovada 20 yoshdan qo'llaniladi. {formatAge(result.age)} uchun tasdiqlangan JSST referensi bo'lmagani sababli
          tasnif, z-score va persentil ko'rsatilmaydi. Faqat BMI qiymati hisoblandi.
        </p>
      </div>
      <dl className="metrics">
        <Metric label="Yosh" value={formatAge(result.age)} />
        <Metric label="Bo'y" value={`${formatNumber(result.heightCm, 1)} sm`} />
        <Metric label="Vazn" value={`${formatNumber(result.weightKg, 1)} kg`} />
      </dl>
      <Notices />
    </>
  );
}

export default function Results({ state }) {
  if (state.status === 'idle') {
    return (
      <section className="card results results--empty" aria-live="polite">
        <LineChart size={28} aria-hidden="true" />
        <h2>Natija shu yerda chiqadi</h2>
        <p>Ma'lumotlarni kiriting va «Hisoblash» tugmasini bosing. Yoshga qarab mos JSST standarti avtomatik tanlanadi:</p>
        <ul className="standards">
          <li>
            <strong>0–5 yosh</strong>
            <span>JSST bolalar o'sish standartlari, 2006</span>
          </li>
          <li>
            <strong>5–19 yosh</strong>
            <span>JSST o'sish referensi, 2007</span>
          </li>
          <li>
            <strong>20 yoshdan</strong>
            <span>JSST kattalar BMI tasnifi</span>
          </li>
        </ul>
      </section>
    );
  }

  if (state.status === 'loading') {
    return (
      <section className="card results results--empty" aria-live="polite" aria-busy="true">
        <Loader2 size={28} className="spin" aria-hidden="true" />
        <p>JSST referens ma'lumotlari yuklanmoqda…</p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className={`card results${state.stale ? ' is-stale' : ''}`} aria-live="polite">
        <div className="alert" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>{state.message}</p>
        </div>
      </section>
    );
  }

  const { result, referenceDate } = state;
  const groupLabel = GROUP_LABELS[result.group];
  return (
    <section className={`card results${state.stale ? ' is-stale' : ''}`} aria-live="polite">
      <div className="card__head card__head--row">
        <h2>Natija</h2>
        <span className="badge">{groupLabel.standardShort}</span>
      </div>
      {state.stale && <p className="stale-note">Ma'lumotlar o'zgardi — yangi natija uchun qayta hisoblang.</p>}
      {result.group === AGE_GROUPS.ADULT && <AdultResult result={result} />}
      {(result.group === AGE_GROUPS.INFANT || result.group === AGE_GROUPS.SCHOOL) && <ChildResult result={result} />}
      {result.group === AGE_GROUPS.GAP && <GapResult result={result} />}
      <p className="results__foot">
        Standart: {groupLabel.standard} · Hisoblash sanasi: {formatDate(referenceDate)}
      </p>
    </section>
  );
}
