import { useState } from 'react';
import { Trash2, Globe, Loader2, ExternalLink } from 'lucide-react';
import { Drawer, Field, StatusBadge, fmtDateTime, toast, todayIso } from './ui.jsx';
import { CATEGORIES, STATUSES } from '../lib/defaults.js';
import { updateLead, deleteLeads, setConsent, isOptedOut, otherContacts, getState, useStore } from '../lib/store.js';
import { enrichWebsite, mergeEnrichment } from '../lib/enrich.js';

export default function LeadDrawer({ leadId, onClose }) {
  const lead = useStore((s) => s.leads.find((l) => l.id === leadId));
  const state = useStore();
  const [busy, setBusy] = useState(false);
  const [consentForm, setConsentForm] = useState(null);
  if (!lead) return null;

  const set = (k) => (e) => updateLead(lead.id, { [k]: e.target.value });
  const blocked = isOptedOut(lead, state.optout);
  const others = otherContacts(lead, state.leads);
  const campaignName = (id) => state.campaigns.find((c) => c.id === id)?.name || 'usunięta kampania';

  async function enrich() {
    if (!lead.website) return toast('Brak adresu strony www.', 'err');
    setBusy(true);
    try {
      const r = await enrichWebsite(lead.website);
      updateLead(lead.id, mergeEnrichment(lead, r));
      toast(r.emails?.length ? `Znaleziono ${r.emails.length} adres(y) e-mail.` : 'Strona nie podaje adresu e-mail.');
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  function saveConsent() {
    setConsent(lead.id, consentForm);
    setConsentForm(null);
    toast(consentForm.status === 'udzielona' ? 'Zgoda zapisana – możesz wysłać ofertę.' : 'Zapisano. Adres trafił na listę wykluczeń.');
  }

  return (
    <Drawer
      title={lead.name || 'Kontakt'}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm(`Usunąć „${lead.name}” z kampanii?`)) {
                deleteLeads([lead.id]);
                onClose();
              }
            }}
          >
            <Trash2 size={16} /> Usuń
          </button>
          <div className="spacer" />
          <button className="btn dark" onClick={onClose}>
            Gotowe
          </button>
        </>
      }
    >
      <div className="stack lg">
        <div className="row">
          <StatusBadge status={lead.status} />
          <small>{campaignName(lead.campaignId)}</small>
          <small>źródło: {lead.source}</small>
        </div>
        {blocked && <div className="notice err">Ten adres jest na liście wykluczeń – nie wysyłaj do niego wiadomości.</div>}
        {others.length > 0 && (
          <div className="notice warn">
            Ta firma jest już w kontakcie w innej kampanii: {others.map((o) => `${campaignName(o.campaignId)} (${o.status})`).join(', ')}. Uzgodnij, kto pisze.
          </div>
        )}

        <div className="grid-2">
          <Field label="Nazwa firmy">
            <input value={lead.name} onChange={set('name')} />
          </Field>
          <Field label="Branża">
            <select value={lead.category} onChange={set('category')}>
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="E-mail do wysyłki">
            <input value={lead.email} onChange={(e) => updateLead(lead.id, { email: e.target.value, emailManual: true })} type="email" list={`em-${lead.id}`} />
            <datalist id={`em-${lead.id}`}>
              {(lead.emails || []).map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </Field>
          <Field label="Telefon">
            <input value={lead.phone} onChange={set('phone')} />
          </Field>
          <Field label="Miasto">
            <input value={lead.city} onChange={set('city')} />
          </Field>
          <Field label="Adres">
            <input value={lead.address} onChange={set('address')} />
          </Field>
        </div>
        {(lead.emails || []).length > 1 && (
          <div className="row tight">
            <small>Inne adresy:</small>
            {lead.emails
              .filter((e) => e !== lead.email)
              .map((e) => (
                <button key={e} className="chip" onClick={() => updateLead(lead.id, { email: e, emailManual: true })}>
                  {e}
                </button>
              ))}
          </div>
        )}
        <Field label="Strona www">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input value={lead.website} onChange={set('website')} placeholder="https://" />
            <button className="btn" onClick={enrich} disabled={busy || !lead.website} title="Pobierz e-mail, telefon i profile social ze strony">
              {busy ? <Loader2 size={16} className="spin" /> : <Globe size={16} />} Pobierz dane
            </button>
            {lead.website && (
              <a className="btn icon" href={lead.website} target="_blank" rel="noreferrer" aria-label="Otwórz stronę">
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </Field>
        <div className="grid-2">
          <Field label="Instagram">
            <input value={lead.instagram} onChange={set('instagram')} placeholder="https://instagram.com/…" />
          </Field>
          <Field label="Facebook">
            <input value={lead.facebook} onChange={set('facebook')} placeholder="https://facebook.com/…" />
          </Field>
          <Field label="LinkedIn">
            <input value={lead.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/company/…" />
          </Field>
          <Field label="Etap">
            <select value={lead.status} onChange={set('status')}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Zdanie personalizujące" hint="Wstawiane w miejsce {{personalizacja}}. Tylko prawdziwe informacje o firmie.">
          <textarea value={lead.hook} onChange={set('hook')} style={{ minHeight: 60 }} />
        </Field>
        <Field label="O firmie (ze strony www)">
          <textarea value={lead.about} onChange={set('about')} style={{ minHeight: 60 }} />
        </Field>

        <div className="panel" style={{ background: 'var(--panel-2)' }}>
          <div className="row">
            <h4>Zgoda na informację handlową</h4>
            <div className="spacer" />
            <span className={`badge ${lead.consent?.status === 'udzielona' ? 's-wygrany' : lead.consent?.status === 'odmowa' ? 's-odmowa' : ''}`}>
              {lead.consent?.status || 'brak'}
            </span>
          </div>
          {lead.consent?.date && (
            <small>
              {lead.consent.date} · {lead.consent.channel} {lead.consent.note && `· ${lead.consent.note}`}
            </small>
          )}
          {!consentForm ? (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => setConsentForm({ status: 'udzielona', date: todayIso(), channel: 'e-mail', note: '' })}>
                Odnotuj zgodę
              </button>
              <button className="btn sm danger" onClick={() => setConsentForm({ status: 'odmowa', date: todayIso(), channel: 'e-mail', note: '' })}>
                Odnotuj odmowę
              </button>
            </div>
          ) : (
            <ConsentForm value={consentForm} onChange={setConsentForm} onSave={saveConsent} onCancel={() => setConsentForm(null)} />
          )}
        </div>

        <Field label="Notatki">
          <textarea value={lead.notes} onChange={set('notes')} style={{ minHeight: 70 }} />
        </Field>

        <div>
          <h4 style={{ marginBottom: 8 }}>Historia</h4>
          {(lead.history || []).length === 0 && <small>Brak działań.</small>}
          {(lead.history || []).map((h, i) => (
            <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <small>{fmtDateTime(h.date)}</small> · {h.text}
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

export function ConsentForm({ value, onChange, onSave, onCancel }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="stack" style={{ marginTop: 10 }}>
      <div className="grid-2">
        <Field label="Data">
          <input type="date" value={value.date} onChange={set('date')} />
        </Field>
        <Field label="Kanał odpowiedzi">
          <select value={value.channel} onChange={set('channel')}>
            {['e-mail', 'Instagram', 'Facebook', 'LinkedIn', 'telefon', 'osobiście'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Dowód / notatka" hint="Np. „odpowiedź e-mail: Tak, proszę przesłać” – przyda się w razie kontroli.">
        <input value={value.note} onChange={set('note')} />
      </Field>
      <div className="row">
        <button className={`btn sm ${value.status === 'udzielona' ? 'dark' : 'danger'}`} onClick={onSave}>
          {value.status === 'udzielona' ? 'Zapisz zgodę' : 'Zapisz odmowę'}
        </button>
        <button className="btn sm ghost" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

export const getLead = (id) => getState().leads.find((l) => l.id === id);
