// Prosty magazyn stanu z zapisem w przeglądarce (localStorage).
// Interfejs jest niezależny od miejsca zapisu – w kolejnej wersji można
// podpiąć Firestore i synchronizować dane w całym zespole.
import { useSyncExternalStore } from 'react';
import { DEFAULT_SENDERS, DEFAULT_SETTINGS, CAMPAIGN_TEMPLATES } from './defaults.js';
import { stampChanges } from './merge.js';

const KEY = 'ktbmatic:v1';
const listeners = new Set();

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const nowIso = () => new Date().toISOString();

function freshState() {
  return {
    version: 1,
    senders: structuredClone(DEFAULT_SENDERS),
    campaigns: [],
    leads: [],
    optout: [],
    settings: { ...DEFAULT_SETTINGS },
    deleted: {},
    sharedU: 0,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const s = JSON.parse(raw);
    return {
      ...freshState(),
      ...s,
      settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}), googleClientId: s.settings?.googleClientId || DEFAULT_SETTINGS.googleClientId },
    };
  } catch {
    return freshState();
  }
}

let state = typeof localStorage !== 'undefined' ? load() : freshState();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Nie udało się zapisać danych', e);
  }
}

export function getState() {
  return state;
}

// meta.remote = zmiana przyszła ze wspólnej bazy (nie stemplujemy jej i nie odsyłamy)
export function setState(updater, meta = {}) {
  const prev = state;
  const next = typeof updater === 'function' ? updater(state) : updater;
  state = meta.remote ? next : stampChanges(prev, next);
  persist();
  listeners.forEach((l) => l(meta));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// ---------- Nadawcy ----------
export function saveSender(sender) {
  setState((s) => {
    const exists = s.senders.some((x) => x.id === sender.id);
    return {
      ...s,
      senders: exists ? s.senders.map((x) => (x.id === sender.id ? sender : x)) : [...s.senders, sender],
    };
  });
}

export function deleteSender(id) {
  setState((s) => ({ ...s, senders: s.senders.filter((x) => x.id !== id) }));
}

// ---------- Kampanie ----------
export function createCampaignFromTemplate(templateKey, overrides = {}) {
  const t = CAMPAIGN_TEMPLATES.find((x) => x.key === templateKey) || CAMPAIGN_TEMPLATES.at(-1);
  const c = {
    id: uid('c'),
    name: t.name,
    senderId: t.senderId || state.senders[0]?.id || '',
    goal: t.goal,
    audience: t.audience,
    categories: [...t.categories],
    location: null,
    templates: structuredClone(t.templates),
    createdAt: nowIso(),
    archived: false,
    ...overrides,
  };
  setState((s) => ({ ...s, campaigns: [c, ...s.campaigns] }));
  return c;
}

export function saveCampaign(c) {
  setState((s) => ({ ...s, campaigns: s.campaigns.map((x) => (x.id === c.id ? c : x)) }));
}

export function deleteCampaign(id) {
  setState((s) => ({
    ...s,
    campaigns: s.campaigns.filter((x) => x.id !== id),
    leads: s.leads.filter((l) => l.campaignId !== id),
  }));
}

// ---------- Kontakty (leady) ----------
const norm = (v) => (v || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export function leadKey(l) {
  if (l.osmId) return `osm:${l.osmId}`;
  return `n:${norm(l.name)}|${norm(l.city)}`;
}

export function emptyLead(partial = {}) {
  return {
    id: uid('l'),
    campaignId: '',
    name: '',
    category: '',
    address: '',
    city: '',
    lat: null,
    lon: null,
    phone: '',
    email: '',
    emails: [],
    website: '',
    facebook: '',
    instagram: '',
    linkedin: '',
    about: '',
    hook: '',
    source: 'ręcznie',
    osmId: '',
    status: 'nowy',
    consent: { status: 'brak', date: '', channel: '', note: '' },
    notes: '',
    history: [],
    drafts: {},
    lastContactAt: '',
    createdAt: nowIso(),
    ...partial,
  };
}

// Dodaje leady do kampanii, pomija duplikaty w tej kampanii. Zwraca dodane rekordy.
export function addLeads(campaignId, leads) {
  let added = [];
  setState((s) => {
    const existing = new Set(s.leads.filter((l) => l.campaignId === campaignId).map(leadKey));
    const fresh = [];
    for (const l of leads) {
      const lead = emptyLead({ ...l, campaignId, id: uid('l') });
      const k = leadKey(lead);
      if (existing.has(k)) continue;
      existing.add(k);
      fresh.push(lead);
    }
    added = fresh;
    return { ...s, leads: [...fresh, ...s.leads] };
  });
  return added;
}

export function updateLead(id, patch) {
  setState((s) => ({
    ...s,
    leads: s.leads.map((l) => (l.id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l)),
  }));
}

export function deleteLeads(ids) {
  const set = new Set(ids);
  setState((s) => ({ ...s, leads: s.leads.filter((l) => !set.has(l.id)) }));
}

export function logEvent(leadId, event) {
  updateLead(leadId, (l) => ({
    history: [{ date: nowIso(), ...event }, ...(l.history || [])],
    lastContactAt: event.contact ? nowIso() : l.lastContactAt,
  }));
}

// ---------- Zgody i wykluczenia ----------
export function setConsent(leadId, consent) {
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return;
  const c = { ...lead.consent, ...consent };
  const patch = { consent: c };
  if (c.status === 'udzielona' && ['nowy', 'zapytanie', 'przypomnienie', 'brak_odp'].includes(lead.status)) patch.status = 'zgoda';
  if (c.status === 'odmowa') patch.status = 'odmowa';
  updateLead(leadId, patch);
  logEvent(leadId, { type: 'zgoda', text: `Zgoda: ${c.status}${c.channel ? ` (${c.channel})` : ''}${c.note ? ` – ${c.note}` : ''}` });
  if (c.status === 'odmowa') {
    const values = [lead.email, ...(lead.emails || [])].filter(Boolean);
    if (values.length === 0 && lead.website) values.push(domainOf(lead.website));
    values.forEach((v) => addOptout(v, `Odmowa: ${lead.name}`));
  }
}

export function domainOf(v) {
  if (!v) return '';
  const s = v.includes('@') ? v.split('@')[1] : v.replace(/^https?:\/\//, '').split('/')[0];
  return s.replace(/^www\./, '').toLowerCase();
}

export function addOptout(value, reason = '') {
  const v = (value || '').trim().toLowerCase();
  if (!v) return;
  setState((s) =>
    s.optout.some((o) => o.value === v) ? s : { ...s, optout: [...s.optout, { value: v, reason, date: nowIso() }] }
  );
}

export function removeOptout(value) {
  setState((s) => ({ ...s, optout: s.optout.filter((o) => o.value !== value) }));
}

// Czy lead jest na liście wykluczeń (adres e-mail lub cała domena)
export function isOptedOut(lead, optout = state.optout) {
  const vals = [lead.email, ...(lead.emails || [])].filter(Boolean).map((x) => x.toLowerCase());
  const doms = new Set([...vals.map(domainOf), lead.website ? domainOf(lead.website) : ''].filter(Boolean));
  return optout.some((o) => vals.includes(o.value) || (!o.value.includes('@') && doms.has(o.value)));
}

// Czy ta sama firma jest już w kontakcie w innej kampanii (np. przez innego nadawcę)
export function otherContacts(lead, leads = state.leads) {
  const k = leadKey(lead);
  const dom = lead.website ? domainOf(lead.website) : lead.email ? domainOf(lead.email) : '';
  return leads.filter(
    (l) =>
      l.id !== lead.id &&
      l.status !== 'nowy' &&
      (leadKey(l) === k || (dom && (domainOf(l.website) === dom || domainOf(l.email) === dom)))
  );
}

// ---------- Ustawienia i kopia zapasowa ----------
export function saveSettings(patch) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function exportBackup() {
  return JSON.stringify({ ...state, exportedAt: nowIso(), settings: { ...state.settings, geminiKey: '' } }, null, 2);
}

export function importBackup(json) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.leads) || !Array.isArray(data.senders)) throw new Error('To nie jest plik kopii KTBmatic.');
  setState({
    ...freshState(),
    ...data,
    settings: { ...DEFAULT_SETTINGS, ...data.settings, geminiKey: state.settings.geminiKey },
  });
}

// Czyści dane tylko w tej przeglądarce – wspólna baza zostaje i zostanie pobrana ponownie.
export function resetAll() {
  setState(freshState(), { remote: true });
}
