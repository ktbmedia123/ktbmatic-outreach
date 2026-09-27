// Wyszukiwanie firm w Google (Gemini + Google Search) i łączenie wyników z mapą OSM.
import { categoryLabel } from './defaults.js';
import { distanceKm } from './osm.js';

// Jak opisać branżę w zapytaniu do Google
const WEB_TERMS = {
  warsztaty: 'warsztaty samochodowe, mechanicy, serwisy aut osobowych',
  wulkanizacje: 'wulkanizacje, serwisy opon i sklepy z oponami',
  sklepy_moto: 'sklepy motoryzacyjne i z częściami samochodowymi',
  dealerzy: 'salony samochodowe i komisy aut',
  skp: 'stacje kontroli pojazdów (SKP)',
  ciezarowe: 'serwisy samochodów ciężarowych i dostawczych, sklepy z częściami do ciężarówek',
  moto2: 'serwisy i sklepy motocyklowe',
  myjnie: 'myjnie samochodowe i studia detailingu',
  stacje_paliw: 'stacje paliw',
  transport: 'firmy transportowe, spedycyjne, kurierskie i logistyczne z flotą pojazdów',
  wynajem: 'wypożyczalnie samochodów i korporacje taxi',
  budowlane: 'firmy budowlane z flotą pojazdów i maszyn',
  rolnicze: 'sklepy i serwisy maszyn rolniczych',
  przemysl: 'zakłady produkcyjne i przemysłowe',
  motorsport: 'tory wyścigowe, kartingowe i firmy motorsportowe',
  szkoly_jazdy: 'szkoły jazdy (ośrodki szkolenia kierowców)',
};

export const webTerm = (id) => WEB_TERMS[id] || categoryLabel(id);

const norm = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\b(sp\.?\s*z\s*o\.?\s*o\.?|s\.?c\.?|sp\.?\s*j\.?|pphu|phu|fhu|p\.?h\.?u\.?|firma|handlowo-uslugowa|uslugowa)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const host = (u = '') => {
  try {
    return new URL(/^https?:/i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const cleanUrl = (u = '') => {
  const s = String(u || '').trim();
  if (!s || /vertexaisearch|google\.com\/(url|search)/i.test(s)) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

const validEmail = (e = '') => (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) ? e.toLowerCase().trim() : '');

export async function searchWeb({ categoryIds, place, radiusKm, keywords, center }) {
  const ids = categoryIds.slice(0, 4);
  const res = await fetch('/api/web-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groups: ids.map(webTerm), place, radiusKm, keywords }),
  });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  if (res.status === 404 || !isJson) throw new Error('Wyszukiwanie Google działa po wdrożeniu na Netlify.');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Błąd ${res.status}`);

  const leads = [];
  for (const f of data.firms || []) {
    if (!f?.name || String(f.name).length < 2) continue;
    const website = cleanUrl(f.website);
    const email = validEmail(f.email);
    const lat = Number(f.lat);
    const lon = Number(f.lon);
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lon) && lat > 48 && lat < 55.5 && lon > 13.5 && lon < 24.5;
    const lead = {
      osmId: `web/${norm(f.name)}|${norm(f.city || '')}`,
      name: String(f.name).trim(),
      category: ids[f.group] || ids[0] || '',
      address: String(f.address || '').trim(),
      city: String(f.city || '').trim(),
      lat: hasGeo ? lat : null,
      lon: hasGeo ? lon : null,
      phone: String(f.phone || '').trim(),
      email,
      emails: email ? [email] : [],
      website,
      facebook: /facebook\.com/i.test(f.facebook || '') ? cleanUrl(f.facebook) : '',
      instagram: '',
      linkedin: '',
      about: String(f.about || '').trim().slice(0, 400),
      source: 'google',
    };
    if (hasGeo && center?.lat) {
      lead.distanceKm = distanceKm(center, lead);
      // współrzędne od AI bywają przybliżone – odrzucamy tylko wyraźnie spoza obszaru
      if (lead.distanceKm > radiusKm * 2 + 5) continue;
    }
    leads.push(lead);
  }
  return { leads: mergeLeads([], leads), sources: data.sources || [], partialErrors: data.errors || [] };
}

// Łączy listy firm z różnych źródeł: ta sama strona www albo ta sama nazwa (+ miasto) = ta sama firma.
export function mergeLeads(base, extra) {
  const out = base.map((l) => ({ ...l, sources: l.sources || [l.source] }));
  const byHost = new Map();
  const byName = new Map();
  const index = (l, i) => {
    const h = host(l.website);
    if (h && !/facebook|instagram|google|panoramafirm|pkt\.pl|oferteo/.test(h)) byHost.set(h, i);
    byName.set(norm(l.name), i);
  };
  out.forEach(index);
  for (const l of extra) {
    const h = host(l.website);
    let i = h ? byHost.get(h) : undefined;
    if (i === undefined) i = byName.get(norm(l.name));
    if (i === undefined) {
      // nazwa zawiera się w innej (np. „Auto Serwis Kowalski” vs „Kowalski Auto Serwis Sp. z o.o.”) i to samo miasto
      const n = norm(l.name);
      i = out.findIndex((o) => {
        const on = norm(o.name);
        return n.length > 5 && on.length > 5 && (on.includes(n) || n.includes(on)) && (!l.city || !o.city || norm(l.city) === norm(o.city));
      });
      if (i === -1) i = undefined;
    }
    if (i === undefined) {
      out.push({ ...l, sources: [l.source] });
      index(out[out.length - 1], out.length - 1);
      continue;
    }
    const o = out[i];
    const emails = [...new Set([...(o.emails || []), ...(l.emails || [])])];
    out[i] = {
      ...o,
      email: o.email || l.email,
      emails,
      phone: o.phone || l.phone,
      website: o.website || l.website,
      facebook: o.facebook || l.facebook,
      address: o.address || l.address,
      city: o.city || l.city,
      lat: o.lat ?? l.lat,
      lon: o.lon ?? l.lon,
      distanceKm: o.distanceKm ?? l.distanceKm,
      about: o.about || l.about,
      sources: [...new Set([...(o.sources || []), l.source])],
    };
  }
  return out;
}
