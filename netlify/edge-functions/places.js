// Wyszukiwanie firm w OpenStreetMap po stronie serwera (Netlify Edge).
// Pyta kilka serwerów Overpass równolegle i zwraca pierwszą poprawną odpowiedź –
// przeglądarka nie czeka w nieskończoność, a CORS nie ma znaczenia.
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'KTBmatic/1.1 (outreach tool; +https://ktbmatic.netlify.app)';
const LIMIT_MS = 20000;

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Użyj POST' }, { status: 405 });
  let query;
  try {
    ({ query } = await req.json());
  } catch {
    return Response.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 });
  }
  if (typeof query !== 'string' || query.length > 6000 || !query.startsWith('[out:json]')) {
    return Response.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 });
  }

  const controllers = MIRRORS.map(() => new AbortController());
  const timer = setTimeout(() => controllers.forEach((c) => c.abort()), LIMIT_MS);
  const errors = [];
  try {
    const data = await Promise.any(
      MIRRORS.map(async (url, i) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({ data: query }),
          signal: controllers[i].signal,
        });
        if (!res.ok) throw new Error(`${new URL(url).host}: ${res.status}`);
        const json = await res.json();
        // Overpass przy przekroczeniu czasu zwraca 200 z pustą listą i "remark" – traktujemy jako błąd
        if (!json.elements?.length && /runtime error|timed out|out of memory/i.test(json.remark || '')) {
          throw new Error(`${new URL(url).host}: przeciążony`);
        }
        controllers.forEach((c, j) => j !== i && c.abort());
        return { elements: json.elements || [], server: new URL(url).host };
      }).map((p) => p.catch((e) => { errors.push(e.message); throw e; })),
    );
    return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    return Response.json(
      { error: 'Serwery mapy OpenStreetMap nie odpowiadają. Spróbuj za chwilę, zmniejsz promień albo użyj wyszukiwania Google.', details: errors },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: '/api/places' };
