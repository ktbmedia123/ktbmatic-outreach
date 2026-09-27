// Pośrednik do Gemini – klucz GEMINI_API_KEY z Netlify (Environment variables).
// Działa jako Edge Function (do ok. 40 s zamiast 10 s) i przy przeciążeniu modelu próbuje kolejnych.
import { requireUser } from '../lib/auth.mjs';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Użyj POST' }, { status: 405 });
  const auth = await requireUser(req, (k) => Netlify.env.get(k));
  if (auth.error) return auth.error;
  const key = Netlify.env.get('GEMINI_API_KEY');
  if (!key) return Response.json({ error: 'Brak GEMINI_API_KEY na Netlify' }, { status: 501 });
  let payload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 });
  }
  const { model = 'gemini-flash-latest', body } = payload;
  if (!/^[a-z0-9.\-]+$/i.test(model) || !body?.contents) return Response.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 });

  const models = [model, ...FALLBACK.filter((m) => m !== model)];
  const started = Date.now();
  let last = { status: 502, error: 'Brak odpowiedzi AI' };
  for (const m of models) {
    if (Date.now() - started > 30000) break;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Math.max(5000, 36000 - (Date.now() - started)));
    try {
      const res = await fetch(`${API}/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        return Response.json({ text, model: m });
      }
      last = { status: res.status, error: data.error?.message || 'Błąd AI' };
      // przeciążenie / limit / wycofany model → następny; błąd zapytania → od razu zwróć
      if (![429, 500, 503, 404].includes(res.status)) break;
    } catch (e) {
      last = { status: 504, error: e.name === 'AbortError' ? 'AI odpowiadało zbyt długo' : e.message };
    } finally {
      clearTimeout(t);
    }
  }
  return Response.json({ error: last.error }, { status: last.status });
};

export const config = { path: '/api/ai' };
