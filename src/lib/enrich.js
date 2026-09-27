// Uzupełnianie danych kontaktowych ze strony www firmy (funkcja Netlify /api/enrich).
export async function enrichWebsite(url) {
  const res = await fetch('/api/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  if (res.status === 404 || !isJson) throw new Error('Pobieranie danych ze stron działa po wdrożeniu na Netlify (albo lokalnie przez „netlify dev”).');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Błąd ${res.status}`);
  return data;
}

// Łączy wynik z istniejącym kontaktem, nie nadpisując danych wpisanych ręcznie.
export function mergeEnrichment(lead, r) {
  const emails = usableEmails([...new Set([...(lead.emails || []), ...(r.emails || [])])]);
  const best = pickBestEmail(emails, lead.website);
  // e-mail wpisany ręcznie zostaje; wybrany automatycznie może zostać zastąpiony lepszym
  const keep = lead.email && (lead.emailManual || !emails.includes(lead.email));
  return {
    emails,
    email: keep ? lead.email : best || lead.email,
    phone: lead.phone || r.phones?.[0] || '',
    facebook: lead.facebook || r.facebook || '',
    instagram: lead.instagram || r.instagram || '',
    linkedin: lead.linkedin || r.linkedin || '',
    about: lead.about && lead.about.length > 40 ? lead.about : [r.title, r.description].filter(Boolean).join(' – ').slice(0, 600),
    enrichedAt: new Date().toISOString(),
  };
}

// Adresy, na które nie piszemy w sprawie współpracy (RODO, rekrutacja, automaty, przykłady ze stron).
const BAD_LOCAL = /^(iod|iodo|kontakt_iodo|inspektor|reklamacje|reklamacja|zwroty|complaints|technicalsupport|technical-support|tech|uktechservice|c\.service|customerservices\d*|rodo|gdpr|dpo|privacy|prywatnosc|daneosobowe|dane\.osobowe|rekrutacja|recruitment|kariera|careers|jobs|praca|hr|noreply|no-reply|donotreply|abuse|postmaster|webmaster|hostmaster|admin|root|test|example|xxx|user|name|email|mail)@/i;
const BAD_DOMAIN = /@(xxx|example|domain|email|test|sentry[^.]*|wixpress)\./i;

export const usableEmails = (emails = []) => emails.filter((e) => e && !BAD_LOCAL.test(e) && !BAD_DOMAIN.test(e));

// Kolejność: dział marketingu / współpracy, potem ogólne adresy firmy, na końcu adresy osób.
const PREF = ['marketing', 'media', 'pr', 'partner', 'partnerzy', 'wspolpraca', 'wspolprace', 'sponsoring', 'sponsor', 'reklama', 'kontakt', 'biuro', 'info', 'office', 'hello', 'hej', 'ahoj', 'sekretariat', 'sklep', 'sales', 'sprzedaz', 'handlowy', 'serwis', 'helpdesk', 'pomoc', 'bok'];

export function pickBestEmail(emails = [], website = '') {
  const site = (website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const rank = (e) => {
    const local = e.split('@')[0].toLowerCase();
    const dom = e.split('@')[1] || '';
    let r = PREF.findIndex((p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}-`) || local.startsWith(p));
    if (r === -1) r = /[._]/.test(local) ? 60 : 40; // imię.nazwisko – na końcu
    const base = site.split('.').slice(-2).join('.');
    if (site && !dom.endsWith(base)) r += 30; // inna domena niż strona firmy
    if (/(^|\.)(pl|com\.pl)$/.test(dom) === false && /\.pl$/.test(site)) r += 5; // np. .cz przy polskiej stronie
    return r;
  };
  // adres z obcej domeny dopuszczamy tylko przy polskiej stronie i polskiej domenie (np. spółka-matka),
  // inaczej to zwykle dystrybutor z innego kraju albo przypadkowy adres ze strony
  const base = site.split('.').slice(-2).join('.');
  const allowed = usableEmails(emails).filter((e) => {
    const dom = (e.split('@')[1] || '').toLowerCase();
    return !site || dom.endsWith(base) || (/\.pl$/.test(site) && /\.pl$/.test(dom));
  });
  return allowed.sort((a, b) => rank(a) - rank(b))[0] || '';
}
