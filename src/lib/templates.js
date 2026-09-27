// Wypełnianie szablonów zmiennymi i kontrola legalności treści.
import { RODO_TEMPLATE, categoryLabel } from './defaults.js';

export const VARIABLES = [
  ['{{firma}}', 'nazwa firmy odbiorcy'],
  ['{{miasto}}', 'miasto odbiorcy (lub lokalizacja kampanii)'],
  ['{{kategoria}}', 'branża odbiorcy'],
  ['{{personalizacja}}', 'zdanie dopasowane do firmy (AI lub ręcznie)'],
  ['{{nadawca}}', 'firma, w imieniu której piszesz'],
  ['{{opis_nadawcy}}', 'neutralny opis nadawcy'],
  ['{{wystepuje_jako}}', 'np. menedżer Łukasza Tasiemskiego'],
  ['{{imie_nadawcy}}', 'osoba podpisująca'],
  ['{{rola}}', 'stanowisko podpisującego'],
  ['{{telefon}}', 'telefon nadawcy'],
  ['{{www}}', 'strona nadawcy'],
  ['{{podpis}}', 'pełny podpis nadawcy'],
  ['{{klauzula}}', 'stopka RODO z prawem sprzeciwu'],
];

const SOURCE_LABEL = {
  osm: 'OpenStreetMap',
  www: 'strona internetowa firmy',
  csv: 'publiczny rejestr / katalog firm',
  ai: 'publicznie dostępne informacje o firmie',
  'ręcznie': 'publicznie dostępne dane kontaktowe firmy',
};

function fill(text, vars) {
  return (text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] ?? '' : m));
}

export function buildVars(lead = {}, sender = {}, campaign = {}) {
  const base = {
    firma: lead.name || '[nazwa firmy]',
    miasto: lead.city || campaign.location?.label?.split(',')[0] || '[miasto]',
    kategoria: categoryLabel(lead.category).toLowerCase() || 'motoryzacja',
    personalizacja: (lead.hook || '').trim(),
    nadawca: sender.company || sender.name || '[nadawca]',
    opis_nadawcy: sender.shortDescription || '',
    wystepuje_jako: sender.actingAs || `przedstawiciel ${sender.company || ''}`.trim(),
    imie_nadawcy: sender.signerName || '[imię i nazwisko]',
    rola: sender.signerRole || '',
    telefon: sender.phone || '',
    www: sender.website || '',
    rodo_admin: sender.rodoAdmin || sender.company || '[administrator danych]',
    rodo_link: sender.rodoLink ? ` Pełna informacja: ${sender.rodoLink}` : '',
    // adres pobrany ze strony firmy (przycisk „Pobierz dane ze stron”) – tak podajemy w klauzuli RODO
    zrodlo: lead.enrichedAt && lead.email && (lead.emails || []).includes(lead.email) ? 'strona internetowa Państwa firmy' : SOURCE_LABEL[lead.source] || SOURCE_LABEL['ręcznie'],
  };
  base.podpis = cleanLines(fill(sender.signature || '{{imie_nadawcy}}\n{{nadawca}}', base))
    .split('\n')
    .filter((l) => l.trim() !== '')
    .join('\n');
  base.klauzula = fill(RODO_TEMPLATE, base);
  return base;
}

// Usuwa puste linie powstałe z niewypełnionych pól (np. brak telefonu),
// ale zachowuje podwójne odstępy między akapitami.
function cleanLines(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+\|\s*$/, '').replace(/^\s*\|\s+/, '').trimEnd())
    .filter((l, i, arr) => !(l === '' && (i === 0 || arr[i - 1] === '')))
    .join('\n')
    .trim();
}

export function render(text, lead, sender, campaign) {
  const vars = buildVars(lead, sender, campaign);
  let out = fill(text, vars);
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

export function renderMessage(tpl, lead, sender, campaign) {
  return {
    subject: render(tpl?.subject || '', lead, sender, campaign).replace(/\s+/g, ' '),
    body: render(tpl?.body || '', lead, sender, campaign),
  };
}

// Miejsca do uzupełnienia w nawiasach kwadratowych, np. [link do prezentacji]
export function findPlaceholders(text) {
  return [...new Set((text || '').match(/\[[^\]\n]{2,80}\]/g) || [])];
}

// Kontrola pierwszej wiadomości: czy nie zawiera treści handlowej.
const COMMERCIAL = [
  [/\b\d+\s?%/, 'procenty / rabat w liczbach'],
  [/\b\d[\d\s.,]*\s?(zł|pln|złotych|eur|€)/i, 'cena lub kwota'],
  [/\brabat\w*/i, 'słowo „rabat”'],
  [/\bpromocj\w*/i, 'słowo „promocja”'],
  [/\bcen(a|y|ę|ami|nik\w*)(?![a-ząćęłńóśźż])/i, 'ceny / cennik'],
  [/\bzni[żz]k\w*/i, 'słowo „zniżka”'],
  [/\bgratis\w*|\bza darmo\b|\bbezpłatn\w*/i, 'gratis / za darmo'],
  [/\boferta specjalna|\bnajlepsz\w* ofert\w*|\bokazj\w*/i, 'język promocyjny'],
  [/\bkup\w*\b|\bzamów\w*\b/i, 'wezwanie do zakupu'],
  [/\bkod\w* rabatow\w*/i, 'kod rabatowy'],
  [/https?:\/\/\S*(sklep|shop|oferta|promo)/i, 'link do sklepu lub oferty'],
];

export function legalCheck(text, step = 'step1') {
  const issues = [];
  const body = text || '';
  if (step === 'step1' || step === 'followup' || step === 'dm1') {
    for (const [re, label] of COMMERCIAL) if (re.test(body)) issues.push({ level: 'error', text: `Może zostać uznane za informację handlową: ${label}. W pierwszym kontakcie pytamy tylko o zgodę.` });
    if (!/zgod|czy mog[ęe]|czy mo[żz]emy|czy wyra[żz]aj/i.test(body)) issues.push({ level: 'warn', text: 'Brak jasnego pytania o zgodę (np. „Czy mogę przesłać…?”).' });
    if (step !== 'followup' && !/nie\s*(b[ęe]d[ęe]|chc)|odpisa[ćc]\s*„?nie|sprzeciw/i.test(body)) issues.push({ level: 'warn', text: 'Brak informacji, jak odmówić dalszego kontaktu.' });
    if (step === 'step1' && !/administrator/i.test(body)) issues.push({ level: 'warn', text: 'Brak stopki RODO – dodaj {{klauzula}}.' });
  }
  const ph = findPlaceholders(body);
  if (ph.length) issues.push({ level: 'error', text: `Do uzupełnienia: ${ph.join(', ')}` });
  if (/\[imię i nazwisko\]|\[nadawca\]/.test(body)) issues.push({ level: 'error', text: 'Uzupełnij dane nadawcy (osoba podpisująca) w zakładce Nadawcy.' });
  return issues;
}

export const hasBlockingIssues = (issues) => issues.some((i) => i.level === 'error');

// Który krok jest następny dla danego kontaktu
export function nextStep(lead, followupDays = 7) {
  switch (lead.status) {
    case 'nowy':
      return 'step1';
    case 'zapytanie': {
      const sent = new Date(lead.lastContactAt || lead.createdAt);
      const due = (Date.now() - sent.getTime()) / 86400000 >= followupDays;
      return due ? 'followup' : null;
    }
    case 'zgoda':
      return 'step2';
    default:
      return null;
  }
}

export const STEP_LABEL = {
  step1: 'Krok 1: zapytanie o zgodę',
  followup: 'Przypomnienie',
  step2: 'Krok 2: oferta',
  dm1: 'Wiadomość DM (Instagram / Facebook / LinkedIn)',
};
