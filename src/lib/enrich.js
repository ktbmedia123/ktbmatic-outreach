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
  const emails = [...new Set([...(lead.emails || []), ...(r.emails || [])])];
  return {
    emails,
    email: lead.email || pickBestEmail(emails),
    phone: lead.phone || r.phones?.[0] || '',
    facebook: lead.facebook || r.facebook || '',
    instagram: lead.instagram || r.instagram || '',
    linkedin: lead.linkedin || r.linkedin || '',
    about: lead.about && lead.about.length > 40 ? lead.about : [r.title, r.description].filter(Boolean).join(' – ').slice(0, 600),
    enrichedAt: new Date().toISOString(),
  };
}

// Preferujemy adresy ogólne firmy (biuro@, kontakt@) – to adresy firmy, nie osób.
export function pickBestEmail(emails = []) {
  const pref = ['kontakt', 'biuro', 'info', 'office', 'sklep', 'serwis', 'sekretariat', 'handlowy', 'sprzedaz', 'marketing'];
  const sorted = [...emails].sort((a, b) => {
    const ia = pref.findIndex((p) => a.startsWith(p));
    const ib = pref.findIndex((p) => b.startsWith(p));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return sorted[0] || '';
}
