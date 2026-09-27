// Weryfikacja logowania Google w funkcjach /api (zwykłych i Edge).
// Przeglądarka wysyła token Google (ID token) w nagłówku Authorization: Bearer …
// Dostęp mają tylko adresy z listy: domyślne + zmienna ALLOWED_EMAILS (po przecinku).
const DEFAULT_ALLOWED = ['ktbmedia1@gmail.com', 'ktbworkspace@gmail.com'];
const cache = new Map();

export function allowedEmails(extra = '') {
  return new Set([...DEFAULT_ALLOWED, ...String(extra || '').split(/[,;\s]+/)].map((e) => e.trim().toLowerCase()).filter(Boolean));
}

const deny = (status, error) => ({ error: Response.json({ error, auth: true }, { status }) });

// getEnv(name) → wartość zmiennej (process.env w funkcjach, Netlify.env.get w Edge)
export async function requireUser(req, getEnv) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return deny(401, 'Zaloguj się, żeby korzystać z KTBmatic.');

  let info = cache.get(token);
  if (!info) {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!res.ok) return deny(401, 'Sesja wygasła – zaloguj się ponownie.');
    info = await res.json();
    if (cache.size > 500) cache.clear();
    cache.set(token, info);
  }
  if (Number(info.exp) * 1000 < Date.now()) {
    cache.delete(token);
    return deny(401, 'Sesja wygasła – zaloguj się ponownie.');
  }
  const clientId = getEnv('VITE_GOOGLE_CLIENT_ID');
  if (clientId && info.aud !== clientId) return deny(401, 'Nieprawidłowy token logowania.');
  const email = String(info.email || '').toLowerCase();
  if (String(info.email_verified) !== 'true' || !allowedEmails(getEnv('ALLOWED_EMAILS')).has(email)) {
    return deny(403, `Konto ${email || '(brak e-maila)'} nie ma dostępu do KTBmatic.`);
  }
  return { user: { email, name: info.name || '' } };
}
