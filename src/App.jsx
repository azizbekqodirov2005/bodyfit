import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import BmiForm from './components/BmiForm.jsx';
import Results from './components/Results.jsx';
import Methodology from './components/Methodology.jsx';
import { BodyFitError, todayISO } from './lib/bmi.js';
import { evaluateBMI } from './lib/evaluate.js';
import { normalizeHeight, parseDecimal } from './lib/validation.js';
import { loadWHOTable } from './lib/whoData.js';
import { ERROR_MESSAGES } from './lib/i18n.js';

const THEME_KEY = 'bodyfit-theme';

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme); // the only value BodyFit stores
    } catch {
      /* storage unavailable — theme still works for this visit */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [state, setState] = useState({ status: 'idle' });

  const handleSubmit = useCallback(async (values) => {
    setState({ status: 'loading' });
    const referenceDate = todayISO();
    try {
      const result = await evaluateBMI(
        {
          birthDate: values.birthDate,
          sex: values.sex,
          heightCm: normalizeHeight(values.height).cm,
          weightKg: parseDecimal(values.weight),
          measurement: values.measurement,
          referenceDate,
        },
        loadWHOTable,
      );
      setState({ status: 'done', result, referenceDate });
    } catch (err) {
      const code = err instanceof BodyFitError ? err.code : 'UNKNOWN';
      if (!(err instanceof BodyFitError)) console.error(err);
      setState({ status: 'error', message: ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN });
    }
  }, []);

  const markStale = useCallback(() => {
    setState((s) => (s.status === 'done' || s.status === 'error' ? { ...s, stale: true } : s));
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar__inner">
          <a className="brand" href="./" aria-label="BodyFit — bosh sahifa">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="7" />
              <path d="M8 20.5h4l2.5-7 3.5 11 2.5-7.5H24" />
            </svg>
            <span className="brand__name">BodyFit</span>
          </a>
          <nav className="topbar__nav" aria-label="Asosiy menyu">
            <a href="#metodologiya">Metodologiya</a>
            <a href="#manbalar">Manbalar</a>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? "Yorug' mavzuga o'tish" : "Qorong'i mavzuga o'tish"}
              title={theme === 'dark' ? "Yorug' mavzu" : "Qorong'i mavzu"}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="container">
        <section className="intro">
          <p className="eyebrow">Jahon sog'liqni saqlash tashkiloti (JSST) standartlari asosida</p>
          <h1>Tana massasi indeksi tahlili</h1>
          <p className="intro__lead">
            Kattalar uchun JSST BMI tasnifi, bolalar va o'smirlar uchun esa yosh va jinsga mos JSST referens
            jadvallari bo'yicha z-score va persentil hisoblanadi.
          </p>
        </section>

        <div className="workspace">
          <BmiForm onSubmit={handleSubmit} onChange={markStale} onReset={reset} busy={state.status === 'loading'} />
          <Results state={state} />
        </div>

        <Methodology />
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <span>Ishlab chiquvchi</span>
            <a
              className="footer__logo-link"
              href="https://t.me/azbekdev"
              target="_blank"
              rel="noopener noreferrer"
              title="AzbekDev Telegram kanali"
            >
              <img
                className="footer__logo footer__logo--light"
                src={`${import.meta.env.BASE_URL}brand/azbekdev-logo-light-theme.png`}
                alt="AzbekDev — Software Solutions"
                width="161"
                height="40"
              />
              <img
                className="footer__logo footer__logo--dark"
                src={`${import.meta.env.BASE_URL}brand/azbekdev-logo-dark-theme.png`}
                alt="AzbekDev — Software Solutions"
                width="161"
                height="40"
              />
            </a>
          </div>
          <p>
            <strong>Tibbiy ogohlantirish.</strong> BodyFit skrining vositasi bo'lib, tibbiy tashxis qo'ymaydi va davolanish
            tavsiya qilmaydi. Sog'lig'ingiz bo'yicha savollar uchun shifokorga murojaat qiling.
          </p>
          <p className="footer__meta">Barcha hisob-kitoblar brauzeringizda bajariladi · Ma'lumotlar serverga yuborilmaydi</p>
        </div>
      </footer>
    </div>
  );
}
