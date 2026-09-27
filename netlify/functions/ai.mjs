// Pośrednik do Gemini – używa klucza GEMINI_API_KEY ustawionego w Netlify (Site settings → Environment variables).
import { requireUser } from '../lib/auth.mjs';
export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Użyj POST' }, { status: 405 });
  const auth = await requireUser(req, (k) => process.env[k]);
  if (auth.error) return auth.error;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'Brak GEMINI_API_KEY na Netlify' }, { status: 501 });
  const { model = 'gemini-flash-latest', body } = await req.json();
  if (!/^[a-z0-9.\-]+$/i.test(model) || !body?.contents) return Response.json({ error: 'Nieprawidłowe zapytanie' }, { status: 400 });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return Response.json({ error: data.error?.message || 'Błąd AI' }, { status: res.status });
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return Response.json({ text });
};
