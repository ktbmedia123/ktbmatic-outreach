// Pobiera stronę firmy (+ podstronę kontakt) i wyciąga: e-maile, telefony, profile social media, opis.
import { requireUser } from '../lib/auth.mjs';
const UA = 'Mozilla/5.0 (compatible; KTBmatic/1.0; +https://ktbmedia.eu)';
const MAX_BYTES = 1_500_000;

const BAD_EMAIL = /\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|sentry|wixpress|@2x|domain\.|yourdomain|email\.com$|u00|\.\./i;

function isPrivateHost(host) {
  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) ||
    host.includes(':')
  );
}

async function fetchPage(url, ms = 4500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return '';
    const reader = res.body.getReader();
    let received = 0;
    const chunks = [];
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
    try { reader.cancel(); } catch {}
    return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

function decodeCf(hex) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

const decodeEntities = (s) =>
  s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, '&').replace(/&quot;/g, '"');

export function extract(html, baseUrl) {
  const text = decodeEntities(html);
  const emails = new Set();
  for (const m of text.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.add(decodeURIComponent(m[1]));
  for (const m of text.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) emails.add(decodeCf(m[1]));
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) emails.add(m[0]);
  // zapisy typu "biuro [at] firma.pl"
  for (const m of text.matchAll(/([a-z0-9._-]+)\s*[\[(]\s*(?:at|małpa)\s*[\])]\s*([a-z0-9.-]+\.[a-z]{2,})/gi)) emails.add(`${m[1]}@${m[2]}`);

  const phones = new Set();
  for (const m of text.matchAll(/tel:([+\d\s().-]{7,})/gi)) phones.add(m[1].replace(/[^\d+]/g, ''));
  if (!phones.size) for (const m of text.matchAll(/(?:\+48[\s-]?)?(?:\d{3}[\s-]\d{3}[\s-]\d{3}|\(?\d{2}\)?[\s-]\d{3}[\s-]\d{2}[\s-]\d{2})/g)) phones.add(m[0].trim());

  const find = (re) => {
    for (const m of text.matchAll(re)) {
      const u = m[0].replace(/["'<>)\\].*$/, '').replace(/\/$/, '');
      if (!/sharer|share\.php|plugins|dialog|\/tr\?|intent|\/p\/|\/reel\/|hashtag|login|policies/i.test(u)) return u.startsWith('http') ? u : `https://${u}`;
    }
    return '';
  };

  const title = (text.match(/<title[^>]*>([^<]{2,200})<\/title>/i)?.[1] || '').trim();
  const description = (text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,400})/i)?.[1] ||
    text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,400})/i)?.[1] || '').trim();

  const contactLinks = [];
  for (const m of text.matchAll(/href=["']([^"'#]+)["'][^>]*>([^<]{0,60})/gi)) {
    const href = m[1];
    const label = m[2] || '';
    if (/kontakt|contact|o-nas|about/i.test(href + ' ' + label)) {
      try {
        const u = new URL(href, baseUrl);
        if (u.hostname === new URL(baseUrl).hostname) contactLinks.push(u.href);
      } catch {}
    }
  }

  return {
    emails: [...emails].map((e) => e.toLowerCase().trim()).filter((e) => !BAD_EMAIL.test(e) && e.length < 80),
    phones: [...phones].slice(0, 3),
    facebook: find(/(?:https?:)?\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9.\-_/?=]+/gi),
    instagram: find(/(?:https?:)?\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+/gi),
    linkedin: find(/(?:https?:)?\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9\-_%]+/gi),
    title,
    description,
    contactLinks: [...new Set(contactLinks)].slice(0, 3),
  };
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Użyj POST' }, { status: 405 });
  const auth = await requireUser(req, (k) => process.env[k]);
  if (auth.error) return auth.error;
  let url;
  try {
    const body = await req.json();
    url = new URL(/^https?:\/\//i.test(body.url) ? body.url : `https://${body.url}`);
  } catch {
    return Response.json({ error: 'Nieprawidłowy adres strony' }, { status: 400 });
  }
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) return Response.json({ error: 'Niedozwolony adres' }, { status: 400 });

  const home = await fetchPage(url.href);
  if (!home) return Response.json({ error: 'Strona nie odpowiada' }, { status: 502 });
  const first = extract(home, url.href);
  const extraPages = await Promise.all(first.contactLinks.map((u) => fetchPage(u, 3500)));
  const merged = { ...first };
  for (const html of extraPages.filter(Boolean)) {
    const r = extract(html, url.href);
    merged.emails = [...new Set([...merged.emails, ...r.emails])];
    merged.phones = [...new Set([...merged.phones, ...r.phones])].slice(0, 3);
    merged.facebook ||= r.facebook;
    merged.instagram ||= r.instagram;
    merged.linkedin ||= r.linkedin;
  }
  delete merged.contactLinks;
  return Response.json(merged, { headers: { 'Cache-Control': 'public, max-age=86400' } });
};
