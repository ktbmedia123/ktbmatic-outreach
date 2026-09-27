// Sponsorzy z YouTube: przegląda opisy filmów twórców (po kanałach albo po temacie) i wyciąga marki,
// które pojawiają się przy słowach „partner”, „sponsor”, „kod rabatowy”, „współpraca” itd.
// YouTube Data API v3 – darmowy limit 10 000 jednostek dziennie (wyszukiwanie tematu = 100, kanał = ~3).
// Nazwy marek porządkuje Gemini (zwykłe zapytanie, bez płatnego wyszukiwania Google).
const YT = 'https://www.googleapis.com/youtube/v3';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];

const SPONSOR_RE = /(partner(em|zy|ka)?\b|sponsor|współprac|wspolprac|kod(em)? rabat|kod zni|rabat|zniżk|znizk|reklam|#ad\b|#reklama|materiał powstał|material powstal|dzięki (firmie|marce)|sprawdź ofert|link afiliacyjny|afiliac|promocj)/i;
const SKIP_HOSTS = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.me|tiktok\.com|twitter\.com|x\.com|linktr\.ee|patronite\.pl|zrzutka\.pl|buycoffee\.to|tipply\.pl|streamlabs\.com|discord\.gg|discord\.com|t\.me|spotify\.com|apple\.com|google\.com|goo\.gl|bit\.ly|wikipedia\.org|threads\.net|twitch\.tv|kick\.com|paypal\.me|patreon\.com|suppi\.pl)$/i;

async function yt(path, params, key) {
  const u = new URL(`${YT}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('key', key);
  const res = await fetch(u);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `YouTube: ${res.status}`);
  return data;
}

async function channelVideos(handle, key, perChannel) {
  const h = handle.trim().replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/\/.*$/, '');
  const params = h.startsWith('UC') ? { part: 'snippet,contentDetails', id: h } : { part: 'snippet,contentDetails', forHandle: h.startsWith('@') ? h : `@${h}` };
  const ch = await yt('channels', params, key);
  const c = ch.items?.[0];
  if (!c) throw new Error(`Nie znaleziono kanału ${handle}`);
  const list = await yt('playlistItems', { part: 'contentDetails', playlistId: c.contentDetails.relatedPlaylists.uploads, maxResults: String(perChannel) }, key);
  return (list.items || []).map((i) => i.contentDetails.videoId);
}

async function topicVideos(q, key, max) {
  const r = await yt('search', { part: 'id', q, type: 'video', regionCode: 'PL', relevanceLanguage: 'pl', maxResults: String(max), order: 'relevance', publishedAfter: new Date(Date.now() - 1000 * 60 * 60 * 24 * 540).toISOString() }, key);
  return (r.items || []).map((i) => i.id.videoId).filter(Boolean);
}

async function videoDetails(ids, key) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await yt('videos', { part: 'snippet,statistics', id: ids.slice(i, i + 50).join(',') }, key);
    out.push(...(r.items || []));
  }
  return out;
}

function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

// Z opisu bierzemy linie z „sygnałem sponsorskim” i linki w ich okolicy (ta sama linia lub następna).
function extractMentions(desc) {
  const lines = (desc || '').split(/\r?\n/);
  const found = [];
  lines.forEach((line, i) => {
    if (!SPONSOR_RE.test(line)) return;
    const ctx = [line, lines[i + 1] || ''].join(' ');
    const links = [...ctx.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => m[0]);
    const hosts = [...new Set(links.map(hostOf).filter((h) => h && !SKIP_HOSTS.test(h)))];
    found.push({ line: line.trim().slice(0, 220), hosts });
  });
  return found;
}

async function nameBrands(key, items) {
  if (!items.length) return {};
  const prompt = `Poniżej fragmenty opisów filmów YouTube z sygnałem sponsorskim. Dla każdej pozycji podaj nazwę marki/firmy, która jest sponsorem lub partnerem (nie twórcy, nie sklepu z merchem twórcy), jej krótką branżę po polsku i czy to faktycznie sponsor/partner reklamowy (true/false).
Zwróć JSON: {"brands":[{"id":0,"brand":"","category":"","sponsor":true}]}
${items.map((it, i) => `${i}. domena: ${it.host || '-'} | tekst: ${it.line}`).join('\n')}`;
  for (const model of MODELS) {
    try {
      const res = await fetch(`${GEMINI}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const parsed = JSON.parse(text.replace(/```(json)?/g, '').trim());
      return Object.fromEntries((parsed.brands || []).map((b) => [b.id, b]));
    } catch {}
  }
  return {};
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Użyj POST' }, { status: 405 });
  const ytKey = Netlify.env.get('YOUTUBE_API_KEY');
  if (!ytKey) return Response.json({ error: 'Brak YOUTUBE_API_KEY na Netlify (klucz „KTBmatic YouTube” z Google Cloud).' }, { status: 501 });
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 });
  }
  const channels = (body.channels || []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 15);
  const topics = (body.topics || []).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (!channels.length && !topics.length) return Response.json({ error: 'Podaj kanały albo tematy' }, { status: 400 });

  const errors = [];
  const ids = new Set();
  await Promise.all([
    ...channels.map((c) => channelVideos(c, ytKey, 30).then((v) => v.forEach((x) => ids.add(x))).catch((e) => errors.push(e.message))),
    ...topics.map((t) => topicVideos(t, ytKey, 50).then((v) => v.forEach((x) => ids.add(x))).catch((e) => errors.push(e.message))),
  ]);
  if (!ids.size) return Response.json({ error: errors[0] || 'Nie znaleziono filmów', errors }, { status: errors.length ? 502 : 200 });

  const videos = await videoDetails([...ids].slice(0, 400), ytKey);
  // grupowanie po domenie (albo po tekście, gdy linku brak)
  const groups = new Map();
  let scanned = 0;
  for (const v of videos) {
    scanned++;
    const s = v.snippet || {};
    for (const m of extractMentions(s.description)) {
      const keys = m.hosts.length ? m.hosts : [];
      if (!keys.length) continue; // bez linku trudno ustalić markę – pomijamy szum
      for (const host of keys) {
        const g = groups.get(host) || { host, line: m.line, channels: new Set(), videos: [], views: 0 };
        g.channels.add(s.channelTitle);
        if (g.videos.length < 3) g.videos.push({ id: v.id, title: s.title, channel: s.channelTitle, date: s.publishedAt?.slice(0, 10) });
        g.views += Number(v.statistics?.viewCount || 0);
        groups.set(host, g);
      }
    }
  }
  const list = [...groups.values()].sort((a, b) => b.channels.size - a.channels.size || b.videos.length - a.videos.length).slice(0, 80);
  const gemKey = Netlify.env.get('GEMINI_API_KEY');
  const names = gemKey ? await nameBrands(gemKey, list.map((g) => ({ host: g.host, line: g.line }))) : {};
  const brands = list
    .map((g, i) => ({
      brand: names[i]?.brand || g.host,
      category: names[i]?.category || '',
      sponsor: names[i]?.sponsor !== false,
      website: `https://${g.host}`,
      evidence: g.line,
      channels: [...g.channels],
      videos: g.videos,
      views: g.views,
    }))
    .filter((b) => b.sponsor);
  return Response.json({ brands, scannedVideos: scanned, errors });
};

export const config = { path: '/api/yt-sponsors' };
