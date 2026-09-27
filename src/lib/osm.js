// Research firm z OpenStreetMap: geokodowanie (Nominatim) + wyszukiwanie w promieniu (Overpass).
// Oba API są darmowe i działają bezpośrednio z przeglądarki.
import { CATEGORIES } from './defaults.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function geocode(query) {
  const url = `${NOMINATIM}?format=jsonv2&limit=5&countrycodes=pl&accept-language=pl&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nie udało się znaleźć lokalizacji (${res.status}).`);
  const data = await res.json();
  return data.map((d) => ({
    label: d.display_name.split(',').slice(0, 3).join(',').trim(),
    full: d.display_name,
    lat: Number(d.lat),
    lon: Number(d.lon),
  }));
}

export function buildQuery(categoryIds, { lat, lon, radiusKm }, limit = 400) {
  const r = Math.round(radiusKm * 1000);
  const parts = [];
  for (const id of categoryIds) {
    const cat = CATEGORIES.find((c) => c.id === id);
    if (!cat) continue;
    for (const f of cat.filters) parts.push(`  nwr${f}["name"](around:${r},${lat},${lon});`);
  }
  return `[out:json][timeout:40];\n(\n${parts.join('\n')}\n);\nout tags center ${limit};`;
}

function matchCategory(tags, allowed) {
  for (const id of allowed) {
    const cat = CATEGORIES.find((c) => c.id === id);
    for (const f of cat?.filters || []) {
      const conds = [...f.matchAll(/\["([^"]+)"(=|~|!~)"([^"]*)"\]/g)];
      const ok = conds.every(([, k, op, v]) => {
        const val = tags[k];
        if (op === '=') return val === v;
        if (op === '~') return val !== undefined && new RegExp(v).test(val);
        if (op === '!~') return val === undefined || !new RegExp(v).test(val);
        return false;
      });
      if (ok) return id;
    }
  }
  return allowed[0] || '';
}

const clean = (v) => (v || '').split(';')[0].trim();

function socialUrl(v, host) {
  if (!v) return '';
  const s = clean(v);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.includes(host)) return `https://${s.replace(/^\/+/, '')}`;
  return `https://www.${host}/${s.replace(/^@/, '')}`;
}

export function elementToLead(el, allowedCategories) {
  const t = el.tags || {};
  const website = clean(t.website || t['contact:website'] || t.url || '');
  const email = clean(t.email || t['contact:email'] || '').toLowerCase();
  const street = [t['addr:street'] || t['addr:place'], t['addr:housenumber']].filter(Boolean).join(' ');
  const city = t['addr:city'] || t['addr:town'] || t['addr:village'] || t['addr:place'] || '';
  return {
    osmId: `${el.type}/${el.id}`,
    name: t.name,
    category: matchCategory(t, allowedCategories),
    address: [street, [t['addr:postcode'], city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    city,
    lat: el.lat ?? el.center?.lat ?? null,
    lon: el.lon ?? el.center?.lon ?? null,
    phone: clean(t.phone || t['contact:phone'] || t['contact:mobile'] || ''),
    email,
    emails: email ? [email] : [],
    website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
    facebook: socialUrl(t['contact:facebook'] || t.facebook, 'facebook.com'),
    instagram: socialUrl(t['contact:instagram'] || t.instagram, 'instagram.com'),
    linkedin: socialUrl(t['contact:linkedin'] || t.linkedin, 'linkedin.com'),
    about: [t.brand, t.operator, t.description].filter(Boolean).join(' · '),
    source: 'osm',
  };
}

function toLeads(elements, categoryIds, center) {
  const seen = new Set();
  const leads = [];
  for (const el of elements || []) {
    if (!el.tags?.name) continue;
    const lead = elementToLead(el, categoryIds);
    const key = `${lead.name.toLowerCase()}|${(lead.address || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (center.lat && lead.lat) lead.distanceKm = distanceKm(center, lead);
    leads.push(lead);
  }
  leads.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return leads;
}

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const outer = opts.signal;
  outer?.addEventListener('abort', () => ctrl.abort());
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Najpierw przez serwer Netlify (/api/places – kilka serwerów Overpass równolegle),
// awaryjnie (np. lokalnie bez Netlify) bezpośrednio z przeglądarki – zawsze z limitem czasu.
export async function searchPlaces(categoryIds, center, { signal } = {}) {
  if (!categoryIds.length) throw new Error('Wybierz co najmniej jedną branżę.');
  const q = buildQuery(categoryIds, center);
  let lastErr;
  try {
    const res = await fetchWithTimeout('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
      signal,
    }, 40000);
    const isJson = (res.headers.get('content-type') || '').includes('json');
    if (isJson) {
      const data = await res.json();
      if (res.ok) return toLeads(data.elements, categoryIds, center);
      if (res.status !== 404) throw Object.assign(new Error(data.error || `Błąd wyszukiwania (${res.status}).`), { final: true });
    }
  } catch (e) {
    if (e.final || signal?.aborted) throw e;
    if (e.name === 'AbortError') throw new Error('Mapa OSM nie odpowiedziała w 40 s. Zmniejsz promień albo użyj wyszukiwania Google.');
    lastErr = e;
  }
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetchWithTimeout(endpoint, { method: 'POST', body: new URLSearchParams({ data: q }), signal }, 25000);
      if (!res.ok) throw new Error(`Błąd wyszukiwania (${res.status}).`);
      const data = await res.json();
      return toLeads(data.elements, categoryIds, center);
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr ||= e;
    }
  }
  throw lastErr || new Error('Wyszukiwanie na mapie nie powiodło się.');
}

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10;
}
