// Wspólna baza zespołu: jeden dokument JSON w Netlify Blobs (darmowe, wbudowane w Netlify).
// GET  → aktualne dane; PUT → scala dane z przeglądarki z zapisanymi (nowsza zmiana rekordu wygrywa).
// Zapis warunkowy (etag) chroni przed nadpisaniem zmian kogoś, kto zapisał w tej samej chwili.
import { getStore } from '@netlify/blobs';
import { requireUser } from '../lib/auth.mjs';
import { emptyShared, mergeShared } from '../../src/lib/merge.js';

const KEY = 'state-v1';
const env = (k) => process.env[k];

export default async (req) => {
  const auth = await requireUser(req, env);
  if (auth.error) return auth.error;
  const store = getStore({ name: 'ktbmatic', consistency: 'strong' });

  if (req.method === 'GET') {
    const data = (await store.get(KEY, { type: 'json' })) || emptyShared();
    return Response.json({ state: data, user: auth.user }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (req.method !== 'PUT') return Response.json({ error: 'Użyj GET lub PUT' }, { status: 405 });
  let incoming;
  try {
    ({ state: incoming } = await req.json());
  } catch {
    return Response.json({ error: 'Nieprawidłowe dane' }, { status: 400 });
  }
  if (!incoming || !Array.isArray(incoming.leads) || !Array.isArray(incoming.campaigns)) {
    return Response.json({ error: 'Nieprawidłowe dane' }, { status: 400 });
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await store.getWithMetadata(KEY, { type: 'json' });
    const merged = mergeShared(current?.data || emptyShared(), incoming);
    merged.savedAt = new Date().toISOString();
    merged.savedBy = auth.user.email;
    const res = await store.setJSON(KEY, merged, current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
    if (res?.modified !== false) {
      // kopia dzienna – na wypadek pomyłki (np. masowego usunięcia)
      const day = merged.savedAt.slice(0, 10);
      await store.setJSON(`backup-${day}`, merged).catch(() => {});
      return Response.json({ state: merged }, { headers: { 'Cache-Control': 'no-store' } });
    }
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 250));
  }
  return Response.json({ error: 'Baza jest zajęta – spróbuj za chwilę.' }, { status: 409 });
};

export const config = { path: '/api/state' };
