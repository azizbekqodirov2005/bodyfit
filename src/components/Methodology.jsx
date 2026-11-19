import { ExternalLink } from 'lucide-react';

const SOURCES = [
  {
    title: "JSST bolalar o'sish standartlari (0–5 yosh)",
    detail: 'BMI-yoshga, kunlik LMS jadvali (0–1826 kun), o‘g‘il va qiz bolalar uchun alohida.',
    links: [
      ['Rasmiy sahifa', 'https://www.who.int/tools/child-growth-standards/'],
      ['Ma’lumot fayli (WHO anthro, commit b776d8a)', 'https://github.com/WorldHealthOrganization/anthro/blob/b776d8a12b1c97369c748b561159fd2ec4f4db58/data-raw/growthstandards/bmianthro.txt'],
    ],
  },
  {
    title: "JSST o'sish referensi 2007 (5–19 yosh)",
    detail: 'BMI-yoshga, oylik LMS jadvali (60–229 oy), o‘g‘il va qiz bolalar uchun alohida.',
    links: [
      ['Rasmiy sahifa', 'https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age/'],
      ['Ma’lumot fayli (WHO anthroplus, commit 7cfcdb3)', 'https://github.com/WorldHealthOrganization/anthroplus/blob/7cfcdb39026e9a55de55732bc3cf14c82261bcf7/data-raw/growthstandards/bfawho2007.txt'],
      ['Hisoblash metodikasi (PDF)', 'https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf'],
    ],
  },
  {
    title: 'JSST kattalar uchun BMI tasnifi',
    detail: '18,5 / 25,0 / 30,0 / 35,0 / 40,0 kg/m² chegaralari.',
    links: [['JSST: semizlik va ortiqcha vazn', 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight']],
  },
];

export default function Methodology() {
  return (
    <>
      <section className="section" id="metodologiya" aria-labelledby="method-title">
        <h2 id="method-title">Metodologiya</h2>
        <div className="method-grid">
          <article>
            <h3>1. BMI</h3>
            <p>
              <code className="formula">BMI = vazn (kg) / bo'y (m)²</code>
            </p>
            <p>Hisob to'liq aniqlikda bajariladi, faqat ko'rsatishda yaxlitlanadi.</p>
          </article>
          <article>
            <h3>2. Yosh</h3>
            <p>
              Yosh tug'ilgan sana va bugungi sana orasidagi to'liq kunlar soni bilan aniqlanadi. Oylar JSST qoidasi bo'yicha{' '}
              <code>kun / 30,4375</code>.
            </p>
            <p>0–5 yoshda shu kunga mos JSST qatori olinadi. 5–19 yoshda L, M, S qo'shni ikki oy orasida chiziqli
              interpolyatsiya qilinadi — bu JSST AnthroPlus dasturining o'z usuli.</p>
          </article>
          <article>
            <h3>3. LMS z-score</h3>
            <p>
              <code className="formula">Z = ((BMI / M)^L − 1) / (L · S)</code>
              <br />
              <code className="formula">L = 0 bo'lsa: Z = ln(BMI / M) / S</code>
            </p>
            <p>
              |Z| &gt; 3 bo'lganda JSST tavsiya qilgan cheklangan usul qo'llanadi: z-score SD2 va SD3 egri chiziqlari
              orasidagi masofa bo'yicha qayta hisoblanadi.
            </p>
          </article>
          <article>
            <h3>4. Persentil va tasnif</h3>
            <p>Persentil z-score'dan standart normal taqsimot funksiyasi (Φ) orqali hisoblanadi.</p>
            <p>
              0–5 yosh: −2 dan past — ozg'inlik, +1 dan yuqori — ortiqcha vazn xavfi, +2 — ortiqcha vazn, +3 — semizlik.
              5–19 yosh: −2 dan past — ozg'inlik, +1 — ortiqcha vazn, +2 — semizlik. |Z| &gt; 5 bo'lsa natija ehtimoliy
              xato sifatida belgilanadi.
            </p>
          </article>
        </div>
      </section>

      <section className="section" id="manbalar" aria-labelledby="sources-title">
        <h2 id="sources-title">Manbalar va cheklovlar</h2>
        <div className="sources">
          {SOURCES.map((s) => (
            <article key={s.title} className="source">
              <h3>{s.title}</h3>
              <p>{s.detail}</p>
              <ul>
                {s.links.map(([label, href]) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {label}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <ul className="limits">
          <li>
            JSSTning 5–19 yosh referensi 228 oy (19 yosh) bilan tugaydi. 19 yoshdan 20 yoshgacha bo'lganlar uchun BMI
            hisoblanadi, lekin tasnif berilmaydi — bu yosh uchun tasdiqlangan JSST jadvali yo'q.
          </li>
          <li>
            Jadvallar JSSTning rasmiy GitHub omboridagi xom fayllardan o'zgartirilmasdan olingan va JSST e'lon qilgan
            haftalik/oylik jadvallar hamda JSSTning namunaviy natijalari bilan solishtirib tekshirilgan.
          </li>
          <li>Edema (shish) holatida JSST BMI-yoshga z-score hisoblamaydi; bunday holatda natija ishonchli emas.</li>
          <li>120 yosh va undan katta yosh qo'llab-quvvatlanmaydi.</li>
        </ul>
      </section>
    </>
  );
}
