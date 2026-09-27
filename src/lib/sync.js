// Synchronizacja z wspólną bazą (/api/state): pobranie po zalogowaniu, wysyłka zmian po chwili bezczynności,
// odświeżanie co 30 s i po powrocie do karty. Przy konflikcie wygrywa nowsza zmiana danego rekordu.
import { useSyncExternalStore } from 'react';
import { getState, setState, subscribe } from './store.js';
import { toShared, mergeShared, applyShared, sharedFingerprint } from './merge.js';

let status = { state: 'idle', at: null, error: '', savedBy: '' };
const listeners = new Set();
const setStatus = (patch) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};
export const useSyncStatus = () => useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), () => status);

let started = false;
let pushTimer = null;
let inflight = false;
let lastServerPrint = '';
let unsubscribe = null;
let pollTimer = null;

function applyRemote(serverShared) {
  lastServerPrint = sharedFingerprint(serverShared);
  const local = toShared(getState());
  const merged = mergeShared(local, serverShared);
  setState((s) => applyShared(s, merged), { remote: true });
  setStatus({ savedBy: serverShared.savedBy || status.savedBy });
  // lokalnie było coś nowszego niż na serwerze → dośle
  return sharedFingerprint(merged) !== lastServerPrint;
}

async function call(method, body) {
  const res = await fetch('/api/state', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  if (!isJson) throw new Error('Wspólna baza działa po wdrożeniu na Netlify.');
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || `Błąd ${res.status}`), { status: res.status });
  return data;
}

export async function pull() {
  if (inflight) return;
  inflight = true;
  setStatus({ state: 'sync' });
  try {
    const { state } = await call('GET');
    const needPush = applyRemote(state);
    setStatus({ state: 'ok', at: new Date(), error: '' });
    if (needPush) schedulePush(0);
  } catch (e) {
    setStatus({ state: 'error', error: e.message });
  } finally {
    inflight = false;
  }
}

async function push() {
  if (inflight) return schedulePush(800);
  inflight = true;
  setStatus({ state: 'sync' });
  try {
    const { state } = await call('PUT', { state: toShared(getState()) });
    applyRemote(state);
    setStatus({ state: 'ok', at: new Date(), error: '' });
  } catch (e) {
    setStatus({ state: 'error', error: e.message });
    if (e.status !== 401 && e.status !== 403) schedulePush(15000);
  } finally {
    inflight = false;
  }
}

function schedulePush(ms = 1500) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, ms);
}

export function startSync() {
  if (started) return;
  started = true;
  unsubscribe = subscribe((meta) => {
    if (!meta?.remote) {
      setStatus({ state: 'pending' });
      schedulePush();
    }
  });
  pull();
  pollTimer = setInterval(() => document.visibilityState === 'visible' && status.state !== 'pending' && pull(), 30000);
  window.addEventListener('focus', onFocus);
  window.addEventListener('beforeunload', onUnload);
}

function onFocus() {
  if (status.state !== 'pending') pull();
}

function onUnload(e) {
  if (status.state === 'pending' || status.state === 'sync') {
    push();
    e.preventDefault();
    e.returnValue = '';
  }
}

export function stopSync() {
  started = false;
  unsubscribe?.();
  clearInterval(pollTimer);
  clearTimeout(pushTimer);
  window.removeEventListener('focus', onFocus);
  window.removeEventListener('beforeunload', onUnload);
}

export const syncNow = () => (status.state === 'pending' ? push() : pull());
