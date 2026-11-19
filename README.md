# BodyFit

**BodyFit** — Jahon sog'liqni saqlash tashkiloti (JSST) standartlari asosida tana massasi indeksini (BMI) hisoblaydigan va baholaydigan veb-ilova. Kattalar uchun JSST BMI tasnifi, bolalar va o'smirlar uchun esa yosh va jinsga mos rasmiy JSST referens jadvallari bo'yicha z-score va persentil hisoblanadi.

Barcha hisob-kitoblar foydalanuvchi brauzerida bajariladi. Shaxsiy o'lchovlar hech qayerga yuborilmaydi va saqlanmaydi.

## Imkoniyatlar

- Tug'ilgan sana, jins, bo'y va vazn asosida BMI hisoblash
- Yoshga qarab mos JSST standartini avtomatik tanlash:
  - **0–5 yosh** — JSST bolalar o'sish standartlari (2006), kunlik jadval
  - **5–19 yosh** — JSST o'sish referensi (2007), oylik jadval
  - **20 yosh va undan katta** — JSST kattalar BMI tasnifi
- Bolalar uchun LMS usulida z-score, persentil va JSST tasnifi
- 5 yoshgacha bolalar uchun bo'y o'lchash usuli (yotgan / tik turgan) va JSST qoidasi bo'yicha ±0,7 sm tuzatish
- Kattalar uchun vizual BMI shkalasi va shu bo'yga mos normal BMI vazn oralig'i
- |z| > 5 bo'lganda natija JSST qoidasiga ko'ra ehtimoliy xato deb belgilanadi va tasnif berilmaydi
- Yorug' va qorong'i mavzu, moslashuvchan dizayn (kompyuter, planshet, telefon)
- To'liq o'zbek tilidagi interfeys

## Texnologiyalar

- React 19, Vite
- JavaScript, zamonaviy CSS (alohida UI kutubxonasisiz)
- Lucide React ikonkalari
- Inter shrifti (`@fontsource-variable/inter`, loyiha ichida — tashqi serverga so'rov yo'q)
- Vitest — testlar

## O'rnatish

Node.js 20 yoki undan yangi versiya talab qilinadi.

```bash
git clone https://github.com/<foydalanuvchi>/bodyfit.git
cd bodyfit
npm install
npm run dev
```

Brauzerda `http://localhost:5173` manzilini oching.

## Buyruqlar

| Buyruq | Vazifasi |
| --- | --- |
| `npm run dev` | Ishlab chiqish serverini ishga tushirish |
| `npm test` | Barcha testlarni bir marta ishga tushirish |
| `npm run test:watch` | Testlarni kuzatuv rejimida ishga tushirish |
| `npm run build` | Production build (`dist/` papkasiga) |
| `npm run preview` | Build natijasini lokal ko'rish |
| `npm run data:build` | `data-raw/` dagi JSST fayllaridan `public/data/*.json` ni qayta yaratish |

`dist/` papkasi istalgan statik hostingga (Netlify, GitHub Pages, Vercel va h.k.) joylanishi mumkin — `base: './'` sozlamasi tufayli ichki papkada ham ishlaydi.

## Loyiha tuzilishi

```
data-raw/                 JSSTning o'zgartirilmagan xom LMS fayllari
scripts/build-who-data.mjs  Xom fayllarni JSON ga o'giruvchi skript
public/data/              Ilova ishlatadigan JSST JSON fayllari
src/lib/bmi.js            Ilmiy hisoblash funksiyalari (UI dan mustaqil)
src/lib/evaluate.js       To'liq baholash jarayoni
src/lib/stats.js          Standart normal taqsimot funksiyasi
src/lib/validation.js     Forma tekshiruvi
src/lib/whoData.js        JSST jadvallarini yuklash va tekshirish
src/lib/i18n.js           O'zbekcha matnlar va formatlash
src/components/           React komponentlari
tests/                    Testlar va JSST namunaviy ma'lumotlari
```

Asosiy funksiyalar: `calculateBMI()`, `calculateAge()`, `calculateLMSZScore()`, `calculatePercentile()`, `classifyChildBMI()`, `classifyAdultBMI()`, `getWHOReference()`.

## Ilmiy metodologiya

**BMI.** `BMI = vazn (kg) / bo'y (m)²`. Hisob to'liq aniqlikda bajariladi, faqat ko'rsatishda yaxlitlanadi.

**Yosh.** Tug'ilgan sana va hisoblash sanasi orasidagi to'liq kunlar soni. Oylar JSST qoidasi bo'yicha `kun / 30,4375` (365,25 / 12).

**Yosh guruhlari** (JSST dasturlaridagi chegaralar):

| Guruh | Shart | Ma'lumot |
| --- | --- | --- |
| 0–5 yosh | yosh < 60 oy (0–1826 kun) | kunlik LMS, aynan shu kun qatori olinadi |
| 5–19 yosh | 60 ≤ yosh < 229 oy | oylik LMS, qo'shni ikki oy orasida chiziqli interpolyatsiya |
| 19 yosh (oraliq) | 229 oy ≤ yosh < 20 yil | tasdiqlangan JSST referensi yo'q — faqat BMI |
| Kattalar | 20 yosh va undan katta | JSST kattalar tasnifi |

5–19 yosh uchun L, M, S qiymatlarini butun oylar orasida chiziqli interpolyatsiya qilish — JSST AnthroPlus dasturi va JSST 2007 makroslarining o'z usuli. 0–5 yoshda interpolyatsiya qilinmaydi.

**Uzunlik / bo'y (0–5 yosh).** JSST 731 kungacha yotgan holdagi uzunlikni, 731 kundan boshlab tik turgan holdagi bo'yni ishlatadi. Agar boshqa usulda o'lchangan bo'lsa, JSST Anthro dasturidagidek 0,7 sm qo'shiladi yoki ayiriladi.

**LMS z-score:**

```
Z = ((BMI / M)^L − 1) / (L · S)      (L ≠ 0)
Z = ln(BMI / M) / S                  (L = 0)
```

|Z| > 3 bo'lganda JSST tavsiya qilgan cheklangan usul qo'llanadi:

```
Z > 3:  Z* = 3 + (BMI − SD3) / (SD3 − SD2)
Z < −3: Z* = −3 + (BMI − SD3neg) / (SD2neg − SD3neg)
```

**Persentil.** `P = Φ(Z) × 100`, bu yerda Φ — standart normal taqsimot funksiyasi (W. J. Cody algoritmi, nisbiy xato < 10⁻¹⁵).

**Tasnif.**

| 0–5 yosh (JSST 2006) | 5–19 yosh (JSST 2007) | Kattalar (JSST) |
| --- | --- | --- |
| z < −3 — og'ir ozg'inlik | z < −3 — og'ir ozg'inlik | < 18,5 — vazn yetishmovchiligi |
| z < −2 — ozg'inlik | z < −2 — ozg'inlik | 18,5–24,9 — normal |
| −2 ≤ z ≤ +1 — normal | −2 ≤ z ≤ +1 — normal | 25,0–29,9 — ortiqcha vazn |
| z > +1 — ortiqcha vazn xavfi | z > +1 — ortiqcha vazn | 30,0–34,9 — I darajali semizlik |
| z > +2 — ortiqcha vazn | z > +2 — semizlik | 35,0–39,9 — II darajali semizlik |
| z > +3 — semizlik | | ≥ 40,0 — III darajali semizlik |

Bolalarda tasnif z-score'ning 2 xonagacha yaxlitlangan qiymati bo'yicha (JSST dasturlari kabi), kattalarda esa BMI'ning 1 xonagacha yaxlitlangan qiymati bo'yicha beriladi — shunda tasnif foydalanuvchi ko'rgan raqamga doim mos keladi. |z| > 5 — JSST bo'yicha ehtimoliy xato, tasnif berilmaydi.

## JSST ma'lumot manbalari

who.int sayti ishlab chiqish muhitidan to'g'ridan-to'g'ri yuklab olinmadi, shuning uchun jadvallar **JSSTning o'z GitHub omborlaridan** — JSST rasmiy dasturlarida ishlatiladigan aynan o'sha fayllardan — o'zgartirilmasdan olindi:

| Fayl | Manba | Versiya | SHA-256 |
| --- | --- | --- | --- |
| `data-raw/who-2006-bmianthro.txt` | [WorldHealthOrganization/anthro](https://github.com/WorldHealthOrganization/anthro) → `data-raw/growthstandards/bmianthro.txt` | commit `b776d8a1`, anthro 1.1.0.9000 | `78a4364e…a0d` |
| `data-raw/who-2007-bfawho2007.txt` | [WorldHealthOrganization/anthroplus](https://github.com/WorldHealthOrganization/anthroplus) → `data-raw/growthstandards/bfawho2007.txt` | commit `7cfcdb39`, anthroplus 1.1.0.9000 | `70ef3260…a6a` |

Har bir `public/data/*.json` faylida manba, commit va xom faylning to'liq SHA-256 xeshi saqlangan.

Rasmiy sahifalar:
- JSST bolalar o'sish standartlari: https://www.who.int/tools/child-growth-standards/
- JSST 5–19 yosh BMI-yoshga: https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age/
- JSST hisoblash metodikasi: https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/computation.pdf

### Ma'lumotlarni tekshirish

- **0–5 yosh:** kunlik jadval JSST e'lon qilgan haftalik (0–13 hafta) BMI-yoshga jadvallari bilan solishtirildi — L, M, S va barcha SD egri chiziqlari (−3…+3) mos keldi. Oylik jadvallar bilan ham qo'shni kunlar orasida mos ekani tekshirildi.
- **5–19 yosh:** JSST AnthroPlus paketidagi namunaviy so'rovnoma (933 yozuv) va JSST hisoblagan z-score'lar bilan solishtirildi — hisoblangan barcha BMI-yoshga z-score'lar JSST natijasi bilan 0,01 aniqlikda **to'liq mos keldi**.

## Testlar

`npm test` 61 ta testni ishga tushiradi: BMI, yosh, LMS z-score, persentil, kattalar va bolalar tasnifi, yosh guruhlari chegaralari, erkak/ayol jadvallari, yo'q yoki buzilgan referens ma'lumot, noto'g'ri kiritishlar va chegaraviy qiymatlar, hamda yuqoridagi JSST namunalari bilan solishtirish.

## Ma'lumotlar cheklovlari

- JSSTning 5–19 yosh referensi 228 oy bilan tugaydi. 229 oydan 20 yoshgacha bo'lganlar uchun BMI hisoblanadi, lekin tasnif, z-score va persentil berilmaydi — bu yosh uchun tasdiqlangan JSST jadvali yo'q, ilova esa boshqa guruh jadvalini o'rniga qo'llamaydi.
- Edema (shish) holatida JSST BMI-yoshga z-score hisoblamaydi. Ilova edemani so'ramaydi; bu haqda ogohlantirish ko'rsatiladi.
- Natija kiritilgan o'lchovlarning aniqligiga bog'liq.
- 120 yosh va undan katta yosh qo'llab-quvvatlanmaydi.

## Maxfiylik

- Barcha hisob-kitoblar brauzerda bajariladi, server yo'q.
- Tug'ilgan sana, jins, bo'y va vazn hech qayerga yuborilmaydi va LocalStorage'da saqlanmaydi.
- Faqat tanlangan mavzu (yorug'/qorong'i) `bodyfit-theme` kaliti bilan saqlanadi.
- Tashqi shrift, analitika yoki kuzatuv skriptlari ishlatilmaydi.

## Tibbiy ogohlantirish

BodyFit — skrining vositasi. U tibbiy tashxis qo'ymaydi va davolanish tavsiya qilmaydi. BMI tana yog'ini bevosita o'lchamaydi; homiladorlik, juda rivojlangan mushak massasi, shishlar va ayrim kasalliklar uning talqiniga ta'sir qiladi. Bolalarda natija o'sish dinamikasi bilan birga baholanishi kerak. Sog'lig'ingiz bo'yicha savollar uchun shifokorga murojaat qiling.

## Litsenziya

JSST LMS jadvallari JSST tomonidan e'lon qilingan; ular olingan `anthro` va `anthroplus` omborlari GPL-3 litsenziyasi ostida tarqatiladi. Loyihani ochiq e'lon qilishdan oldin o'zingizga mos litsenziyani tanlang va ushbu manbalarni ko'rsating.
