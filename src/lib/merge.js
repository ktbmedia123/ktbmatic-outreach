// Scalanie danych z kilku przeglądarek (wspólna baza zespołu).
// Każdy rekord ma znacznik ostatniej zmiany `_u` (ms). Usunięcia zapisujemy jako „nagrobki” w `deleted`,
// żeby skasowany rekord nie wrócił z innej przeglądarki. Wygrywa nowsza zmiana danego rekordu.

export const COLLECTIONS = ['senders', 'campaigns', 'leads'];
// Ustawienia wspólne dla zespołu (reszta, np. prywatny klucz Gemini, zostaje w przeglądarce)
export const SHARED_SETTINGS = ['dailyLimit', 'followupDays', 'geminiModel'];

const keyOf = (coll, item) => (coll === 'optout' ? `optout:${item.value}` : `${coll}:${item.id}`);

export function emptyShared() {
  return { senders: [], campaigns: [], leads: [], optout: [], shared: { _u: 0 }, deleted: {} };
}

// Wycina z pełnego stanu aplikacji część synchronizowaną
export function toShared(state) {
  const shared = { _u: state.sharedU || 0 };
  for (const k of SHARED_SETTINGS) shared[k] = state.settings?.[k];
  return {
    senders: state.senders || [],
    campaigns: state.campaigns || [],
    leads: state.leads || [],
    optout: state.optout || [],
    shared,
    deleted: state.deleted || {},
  };
}

function mergeList(coll, a = [], b = [], deleted) {
  const map = new Map();
  for (const item of [...a, ...b]) {
    const k = keyOf(coll, item);
    const cur = map.get(k);
    if (!cur || (item._u || 0) > (cur._u || 0)) map.set(k, item);
  }
  const out = [];
  for (const [k, item] of map) {
    if ((deleted[k] || 0) >= (item._u || 0) && deleted[k]) continue;
    out.push(item);
  }
  return out;
}

export function mergeShared(a = emptyShared(), b = emptyShared()) {
  const deleted = { ...(a.deleted || {}) };
  for (const [k, t] of Object.entries(b.deleted || {})) deleted[k] = Math.max(deleted[k] || 0, t);
  // nagrobki starsze niż 180 dni nie są już potrzebne
  const cutoff = Date.now() - 180 * 864e5;
  for (const k of Object.keys(deleted)) if (deleted[k] < cutoff) delete deleted[k];
  const out = { deleted };
  for (const c of COLLECTIONS) out[c] = mergeList(c, a[c], b[c], deleted);
  out.optout = mergeList('optout', a.optout, b.optout, deleted);
  const sa = a.shared || { _u: 0 };
  const sb = b.shared || { _u: 0 };
  out.shared = (sb._u || 0) > (sa._u || 0) ? sb : sa;
  // kolejność: najnowsze na górze (tak jak w aplikacji)
  for (const c of ['campaigns', 'leads']) out[c].sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''));
  return out;
}

// Porównuje stan przed i po zmianie: stempluje zmienione rekordy, dopisuje nagrobki usuniętych.
export function stampChanges(prev, next, now = Date.now()) {
  const deleted = { ...(next.deleted || prev.deleted || {}) };
  const result = { ...next, deleted };
  for (const c of [...COLLECTIONS, 'optout']) {
    const before = new Map((prev[c] || []).map((i) => [keyOf(c, i), i]));
    const after = new Set();
    result[c] = (next[c] || []).map((item) => {
      const k = keyOf(c, item);
      after.add(k);
      const old = before.get(k);
      if (old === item) return item;
      if (deleted[k]) delete deleted[k]; // rekord przywrócony / dodany ponownie
      return { ...item, _u: now };
    });
    for (const k of before.keys()) if (!after.has(k)) deleted[k] = now;
  }
  const changedShared = SHARED_SETTINGS.some((k) => prev.settings?.[k] !== next.settings?.[k]);
  if (changedShared) result.sharedU = now;
  return result;
}

// Wkleja scalone dane wspólne do pełnego stanu aplikacji (ustawienia prywatne zostają)
export function applyShared(state, shared) {
  const settings = { ...state.settings };
  if ((shared.shared?._u || 0) >= (state.sharedU || 0)) {
    for (const k of SHARED_SETTINGS) if (shared.shared?.[k] !== undefined) settings[k] = shared.shared[k];
  }
  return {
    ...state,
    senders: shared.senders,
    campaigns: shared.campaigns,
    leads: shared.leads,
    optout: shared.optout,
    deleted: shared.deleted,
    sharedU: Math.max(state.sharedU || 0, shared.shared?._u || 0),
    settings,
  };
}

// Czy dwie wersje danych wspólnych różnią się (żeby nie wysyłać niepotrzebnie)
export function sharedFingerprint(s) {
  let n = 0;
  for (const c of [...COLLECTIONS, 'optout']) for (const i of s[c] || []) n = (n * 31 + (i._u || 1)) % 2147483647;
  return `${n}:${Object.keys(s.deleted || {}).length}:${s.shared?._u || 0}:${COLLECTIONS.map((c) => (s[c] || []).length).join(',')}`;
}
