// Wyszukiwanie firm w Google – przez Gemini z narzędziem Google Search (darmowy limit klucza GEMINI_API_KEY).
// Działa jako Netlify Edge Function, bo wyszukiwanie z AI trwa zwykle 10–30 s (zwykłe funkcje mają limit 10 s).
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];

function buildPrompt({ what, place, radiusKm, keywords, max }) {
  return `Użyj wyszukiwarki Google i znajdź realnie działające firmy: ${what}.
Obszar: ${place} i miejscowości w promieniu ok. ${radiusKm} km.
${keywords ? `Dodatkowe kryteria: ${keywords}.` : ''}
Szukaj w wizytówkach Google, na stronach firm, w katalogach (np. Panorama Firm, pkt.pl, oferteo) i na Facebooku.
Podaj do ${max} różnych firm, najbliższe najpierw. Nie powtarzaj firm. Pomijaj firmy zamknięte.
Dane kontaktowe (telefon, e-mail, strona, Facebook) podawaj WYŁĄCZNIE, jeśli widzisz je w wynikach wyszukiwania – inaczej zostaw pusty string. Nie zgaduj adresów e-mail.
Współrzędne lat/lon podaj tylko, jeśli znasz dokładny adres – inaczej null.
Odpowiedz wyłącznie tablicą JSON, bez komentarza:
[{"name":"","address":"","city":"","phone":"","email":"","website":"","facebook":"","lat":null,"lon":null,"about":"krótko czym się zajmuje"}]`;
}

function parseList(text) {
  const clean = text.replace(/```(json)?/g, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function ask(key, prompt) {
  const errs = [];
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 38000);
    try {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        errs.push(`${model}: ${(data.error?.message || `Błąd ${res.status}`).slice(0, 160)}`);
        continue; // inny model może mieć osobny darmowy limit
      }
      const cand = data.candidates?.[0];
      const text = cand?.content?.parts?.map((p) => p.text || '').join('') || '';
      const sources = (cand?.groundingMetadata?.groundingChunks || [])
        .map((c) => c.web)
        .filter(Boolean)
        .map((w) => ({ title: w.title, uri: w.uri }));
      return { firms: parseList(text), sources };
    } catch (e) {
      errs.push(`${model}: ${e.name === 'AbortError' ? 'Wyszukiwanie trwało zbyt długo' : e.message}`);
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error(errs.join(' || ') || 'Brak odpowiedzi');
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Użyj POST' }, { status: 405 });
  const key = Netlify.env.get('GEMINI_API_KEY');
  if (!key) return Response.json({ error: 'Brak GEMINI_API_KEY na Netlify' }, { status: 501 });
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 });
  }
  const groups = (Array.isArray(body.groups) ? body.groups : []).map(String).filter(Boolean).slice(0, 4);
  const place = String(body.place || '').slice(0, 200);
  const radiusKm = Math.min(Math.max(Number(body.radiusKm) || 10, 1), 100);
  const keywords = String(body.keywords || '').slice(0, 300);
  if (!groups.length || !place) return Response.json({ error: 'Podaj lokalizację i branżę' }, { status: 400 });

  const max = groups.length > 2 ? 15 : 25;
  const results = await Promise.allSettled(groups.map((what) => ask(key, buildPrompt({ what, place, radiusKm, keywords, max }))));
  const firms = [];
  const sources = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      r.value.firms.forEach((f) => firms.push({ ...f, group: i }));
      sources.push(...r.value.sources);
    } else errors.push(r.reason?.message || 'błąd');
  });
  if (!firms.length && errors.length) {
    const limit = errors.some((e) => /quota|exhausted|rate/i.test(e));
    return Response.json(
      { error: limit ? 'Wyczerpany darmowy limit wyszukiwań Google w Gemini. Użyj mapy OSM albo spróbuj później.' : `Wyszukiwanie Google nie powiodło się: ${errors[0]}`, details: errors[0]?.slice(0, 900) },
      { status: limit ? 429 : 502 },
    );
  }
  return Response.json({ firms, sources: sources.slice(0, 30), errors });
};

export const config = { path: '/api/web-search' };
