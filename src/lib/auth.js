// Logowanie do KTBmatic przez Google (Google Identity Services – token ID).
// Token trzymamy w localStorage (wspólny dla wszystkich kart, ważny ok. 1 h); każde zapytanie /api dostaje go w nagłówku.
import { useSyncExternalStore } from 'react';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const KEY = 'ktbmatic:session';
let session = readSession();
const listeners = new Set();
let gisPromise;
let initializedFor = '';

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s && s.exp > Date.now() + 60_000 ? s : null;
  } catch {
    return null;
  }
}

function setSession(s) {
  session = s;
  try {
    s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

// logowanie / wylogowanie w innej karcie
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    session = readSession();
    listeners.forEach((l) => l());
  });
  // wygaśnięcie tokenu (ok. 1 h) → ekran logowania, który spróbuje odnowić sesję automatycznie
  setInterval(() => {
    if (session && session.exp < Date.now() + 30_000) setSession(null);
  }, 30_000);
}

export function useSession() {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => session,
  );
}

export const getToken = () => (session && session.exp > Date.now() ? session.token : '');

function decodeJwt(token) {
  const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(part)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
  return JSON.parse(json);
}

export function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
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

function onCredential(resp) {
  try {
    sessionStorage.removeItem('ktbmatic:denied');
  } catch {}
  try {
    const p = decodeJwt(resp.credential);
    setSession({ token: resp.credential, exp: p.exp * 1000, email: p.email, name: p.name || p.email, picture: p.picture || '' });
  } catch {
    setSession(null);
  }
}

export async function initSignIn(clientId) {
  if (!clientId) throw new Error('Brak Google Client ID (VITE_GOOGLE_CLIENT_ID na Netlify).');
  await loadGis();
  if (initializedFor !== clientId) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: onCredential,
      auto_select: true,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      itp_support: true,
    });
    initializedFor = clientId;
  }
}

export async function renderSignInButton(el, clientId) {
  await initSignIn(clientId);
  window.google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'rectangular', locale: 'pl', width: 280 });
  window.google.accounts.id.prompt();
}

export function signOut() {
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {}
  setSession(null);
}

// Sesja wygasła albo serwer odrzucił token → wracamy do ekranu logowania.
export function expireSession() {
  setSession(null);
}

// Dopina token do wszystkich zapytań /api (poza /api/status). Wywołać raz przy starcie.
export function installApiAuth() {
  if (window.__ktbAuthFetch) return;
  window.__ktbAuthFetch = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isApi = url.startsWith('/api/') && !url.startsWith('/api/status');
    if (!isApi) return orig(input, init);
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await orig(input, { ...init, headers });
    if (res.status === 401) expireSession();
    if (res.status === 403) {
      const data = await res.clone().json().catch(() => ({}));
      if (data.auth) {
        try { sessionStorage.setItem('ktbmatic:denied', data.error || 'To konto nie ma dostępu.'); } catch {}
        signOut();
      }
    }
    return res;
  };
}
