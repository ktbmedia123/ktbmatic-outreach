// Poczta: szkice w Gmailu (Gmail API + logowanie Google w przeglądarce),
// pliki .eml (otwierają się jako gotowa do wysłania wiadomość w Outlooku / Thunderbirdzie)
// oraz link mailto: jako najprostszy wariant.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/gmail.compose';

function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

const b64url = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function encodeHeader(v) {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64utf8(v)}?=`;
}

function wrap76(s) {
  return s.replace(/(.{76})/g, '$1\r\n');
}

export function buildMime({ fromName, fromEmail, to, subject, body, unsent = false }) {
  const headers = [];
  if (fromEmail) headers.push(`From: ${fromName ? `${encodeHeader(fromName)} ` : ''}<${fromEmail}>`);
  if (to) headers.push(`To: ${to}`);
  headers.push(`Subject: ${encodeHeader(subject || '')}`);
  headers.push('MIME-Version: 1.0');
  if (unsent) headers.push('X-Unsent: 1');
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push('Content-Transfer-Encoding: base64');
  const normalized = (body || '').replace(/\r?\n/g, '\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${wrap76(b64utf8(normalized))}`;
}

export function downloadEml(msg, filename = 'wiadomosc') {
  const mime = buildMime({ ...msg, unsent: true });
  const blob = new Blob([mime], { type: 'message/rfc822' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(filename)}.eml`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export function mailtoHref({ to, subject, body }) {
  return `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
}

export function slug(s) {
  return (s || 'plik')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .toLowerCase();
}

// ---------- Gmail ----------
let gisPromise;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Nie udało się załadować logowania Google.'));
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

// Tokeny trzymamy tylko w pamięci karty (ważne ok. 1 h), osobno dla każdego nadawcy.
const tokens = new Map();

export function gmailConnectedAs(senderId) {
  const t = tokens.get(senderId);
  return t && t.expiresAt > Date.now() ? t.email : null;
}

export async function gmailConnect(senderId, clientId, hintEmail) {
  if (!clientId) throw new Error('Brak Google Client ID – dodaj go w Ustawieniach (instrukcja w README).');
  await loadGis();
  const resp = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      hint: hintEmail || undefined,
      callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r)),
      error_callback: (e) => reject(new Error(e?.message || 'Logowanie przerwane.')),
    });
    client.requestAccessToken({ prompt: tokens.has(senderId) ? '' : 'select_account' });
  });
  let email = '';
  try {
    const me = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${resp.access_token}` },
    }).then((r) => r.json());
    email = me.emailAddress || '';
  } catch {
    /* brak adresu nie blokuje pracy */
  }
  tokens.set(senderId, { token: resp.access_token, expiresAt: Date.now() + (resp.expires_in - 60) * 1000, email });
  return email;
}

export async function gmailCreateDraft(senderId, msg) {
  const t = tokens.get(senderId);
  if (!t || t.expiresAt < Date.now()) throw new Error('Połącz konto Gmail tego nadawcy.');
  const raw = b64url(b64utf8(buildMime({ ...msg, fromEmail: msg.fromEmail || t.email })));
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gmail: ${err.error?.message || res.status}`);
  }
  return res.json();
}
