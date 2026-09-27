import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles, Globe, Mail, Loader2, Download, Trash2, Plus, Mails } from 'lucide-react';
import { useStore, saveCampaign, deleteCampaign, updateLead, deleteLeads, isOptedOut, addLeads } from '../lib/store.js';
import { CATEGORIES, categoryLabel } from '../lib/defaults.js';
import { nextStep, legalCheck, renderMessage, STEP_LABEL, VARIABLES } from '../lib/templates.js';
import { sendEmail, sentToday } from '../lib/outreach.js';
import { gmailConnect, gmailConnectedAs } from '../lib/mail.js';
import { personalizeHook } from '../lib/ai.js';
import { enrichWebsite, mergeEnrichment } from '../lib/enrich.js';
import { leadsToCsv, downloadText } from '../lib/csv.js';
import { slug } from '../lib/mail.js';
import { Livery, StatusBadge, Issues, Field, Empty, go, toast, plural } from '../components/ui.jsx';
import Composer from '../components/Composer.jsx';
import LeadDrawer from '../components/LeadDrawer.jsx';

export default function CampaignView({ id, tab = 'wysylka' }) {
  const state = useStore();
  const campaign = state.campaigns.find((c) => c.id === id);
  const [openLead, setOpenLead] = useState(null);
  if (!campaign)
    return (
      <div className="panel">
        <Empty title="Nie ma takiej kampanii" action={<button className="btn" onClick={() => go('kampanie')}>Wróć do kampanii</button>}>
          Mogła zostać usunięta.
        </Empty>
      </div>
    );
  const sender = state.senders.find((s) => s.id === campaign.senderId);
  const leads = state.leads.filter((l) => l.campaignId === campaign.id);
  const TABS = [
    ['wysylka', 'Wysyłka', leads.filter((l) => nextStep(l, state.settings.followupDays)).length],
    ['firmy', 'Firmy', leads.length],
    ['tresci', 'Treści'],
    ['ustawienia', 'Ustawienia'],
  ];

  return (
    <>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <small><a href="#/kampanie">Kampanie</a></small>
          <h1>{campaign.name}</h1>
        </div>
        <button className="btn" onClick={() => go(`research/${campaign.id}`)}>
          <Search size={16} /> Znajdź więcej firm
        </button>
      </div>
      <Livery
        sender={sender}
        right={
          sender && (
            <button className="btn sm" onClick={() => go(`nadawcy/${sender.id}`)}>
              Dane nadawcy
            </button>
          )
        }
      />
      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map(([k, label, n]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => go(`kampania/${campaign.id}/${k}`)}>
            {label}
            {n !== undefined && <span className="n">{n}</span>}
          </button>
        ))}
      </div>
      {!sender ? (
        <div className="notice warn">Ta kampania nie ma nadawcy. Wybierz go w zakładce Ustawienia.</div>
      ) : tab === 'wysylka' ? (
        <Workspace campaign={campaign} sender={sender} leads={leads} onOpenLead={setOpenLead} />
      ) : tab === 'firmy' ? (
        <LeadsTable campaign={campaign} leads={leads} onOpenLead={setOpenLead} />
      ) : tab === 'tresci' ? (
        <TemplatesEditor campaign={campaign} sender={sender} sample={leads[0]} />
      ) : (
        <CampaignSettings campaign={campaign} />
      )}
      {openLead && <LeadDrawer leadId={openLead} onClose={() => setOpenLead(null)} />}
    </>
  );
}

// ---------------- Wysyłka ----------------
const FILTERS = [
  ['todo', 'Do wysłania'],
  ['waiting', 'Czekają na odpowiedź'],
  ['consent', 'Zgody'],
  ['all', 'Wszystkie'],
];

function Workspace({ campaign, sender, leads, onOpenLead }) {
  const { settings, optout } = useStore();
  const [filter, setFilter] = useState('todo');
  const [activeId, setActiveId] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [batch, setBatch] = useState(null);

  const [autoNext, setAutoNext] = useState(true);
  const filters = useMemo(
    () => ({
      todo: (l) => !!nextStep(l, settings.followupDays) && !isOptedOut(l, optout),
      waiting: (l) => ['zapytanie', 'przypomnienie'].includes(l.status) && !nextStep(l, settings.followupDays),
      consent: (l) => l.consent?.status === 'udzielona',
      all: () => true,
    }),
    [settings.followupDays, optout]
  );
  const counts = useMemo(() => Object.fromEntries(Object.entries(filters).map(([k, f]) => [k, leads.filter(f).length])), [filters, leads]);
  const list = useMemo(
    () => leads.filter(filters[filter]).sort((a, b) => (b.email ? 1 : 0) - (a.email ? 1 : 0) || (a.distanceKm ?? 999) - (b.distanceKm ?? 999)),
    [leads, filter, filters]
  );

  // Otwarta firma zostaje na ekranie, nawet gdy po wysyłce zmieni etap i wypadnie z filtra
  useEffect(() => {
    if ((!activeId || !leads.some((l) => l.id === activeId)) && list[0]) setActiveId(list[0].id);
  }, [activeId, list, leads]);
  const active = leads.find((l) => l.id === activeId) || list[0];
  const activeIdx = list.findIndex((l) => l.id === active?.id);
  const next = list[activeIdx + 1] || (activeIdx === -1 ? list[0] : null);
  const prev = activeIdx > 0 ? list[activeIdx - 1] : null;

  // Klawisze J / K – następna / poprzednia firma (poza polami tekstowymi)
  useEffect(() => {
    const h = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === 'j' && next) setActiveId(next.id);
      if (e.key === 'k' && prev) setActiveId(prev.id);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  // przewiń listę do otwartej firmy
  useEffect(() => {
    document.querySelector('.ws-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [active?.id]);
  const toggle = (id) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selected = list.filter((l) => checked.has(l.id));

  async function runBatch(kind) {
    const items = selected.length ? selected : [];
    if (!items.length) return;
    setBatch({ kind, done: 0, total: items.length, ok: 0, skipped: [] });
    try {
      if (kind === 'gmail' && !gmailConnectedAs(sender.id)) await gmailConnect(sender.id, settings.googleClientId, sender.email);
    } catch (e) {
      toast(e.message, 'err');
      setBatch(null);
      return;
    }
    let ok = 0;
    const skipped = [];
    for (const [i, l0] of items.entries()) {
      const l = { ...l0 };
      try {
        if (kind === 'gmail') {
          if (sentToday(sender.id) >= settings.dailyLimit) {
            skipped.push(`${l.name}: dzienny limit`);
          } else {
            const step = nextStep(l, settings.followupDays);
            if (!step) skipped.push(`${l.name}: nic do wysłania`);
            else {
              await sendEmail(l, step, campaign, sender, 'gmail');
              ok++;
            }
          }
        } else if (kind === 'enrich') {
          if (!l.website) skipped.push(`${l.name}: brak www`);
          else {
            const r = await enrichWebsite(l.website);
            updateLead(l.id, mergeEnrichment(l, r));
            if (r.emails?.length) ok++;
            else skipped.push(`${l.name}: brak e-maila na stronie`);
          }
        } else if (kind === 'ai') {
          const hook = await personalizeHook({ lead: l, sender, campaign });
          updateLead(l.id, (x) => ({ hook, drafts: {} }));
          ok++;
          await new Promise((r) => setTimeout(r, 4500)); // darmowy limit Gemini: ok. 15 zapytań na minutę
        }
      } catch (e) {
        skipped.push(`${l.name}: ${e.message}`);
      }
      setBatch({ kind, done: i + 1, total: items.length, ok, skipped: [...skipped] });
    }
    const label = { gmail: 'szkiców w Gmailu', enrich: 'firm z nowym e-mailem', ai: 'spersonalizowanych wiadomości' }[kind];
    toast(`Gotowe: ${ok} ${label}${skipped.length ? `, pominięto ${skipped.length}` : ''}.`);
    setChecked(new Set());
  }

  if (!leads.length)
    return (
      <div className="panel">
        <Empty title="Kampania nie ma jeszcze firm" action={<button className="btn primary" onClick={() => go(`research/${campaign.id}`)}><Search size={16} /> Znajdź firmy</button>}>
          Wyszukaj firmy na mapie, wczytaj CSV albo poproś AI o propozycje.
        </Empty>
      </div>
    );

  return (
    <div className="ws">
      <div className="panel flush">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 6 }}>
          <div className="chips">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => { setFilter(k); setActiveId(null); }}>
                {label}
                <span className="cnt">{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel-head" style={{ gap: 6, flexWrap: 'wrap', background: 'var(--panel-2)' }}>
          <input
            type="checkbox"
            aria-label="Zaznacz wszystkie"
            checked={list.length > 0 && selected.length === list.length}
            onChange={(e) => setChecked(e.target.checked ? new Set(list.map((l) => l.id)) : new Set())}
          />
          <small style={{ marginRight: 'auto' }}>{selected.length ? `zaznaczono ${selected.length}` : plural(list.length, 'firma', 'firmy', 'firm')}</small>
          <button className="btn sm icon" title="Pobierz dane ze stron www" aria-label="Pobierz dane ze stron www" disabled={!selected.length || !!batch?.total && batch.done < batch.total} onClick={() => runBatch('enrich')}>
            <Globe size={15} />
          </button>
          <button className="btn sm icon" title="Personalizuj (AI)" aria-label="Personalizuj AI" disabled={!selected.length || !!batch?.total && batch.done < batch.total} onClick={() => runBatch('ai')}>
            <Sparkles size={15} />
          </button>
          {sender.mailMode === 'gmail' && (
            <button className="btn sm" title="Utwórz szkice w Gmailu dla zaznaczonych" disabled={!selected.length || !!batch?.total && batch.done < batch.total} onClick={() => runBatch('gmail')}>
              <Mails size={15} /> Szkice
            </button>
          )}
        </div>
        {batch && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
            <div className="row" style={{ marginBottom: 6 }}>
              <small>{batch.done < batch.total ? <><Loader2 size={13} className="spin" /> Przetwarzam {batch.done}/{batch.total}</> : `Gotowe: ${batch.ok} z ${batch.total}`}</small>
              <div className="spacer" />
              {batch.done >= batch.total && <button className="btn ghost sm" onClick={() => setBatch(null)}>Zamknij</button>}
            </div>
            <div className="progress"><i style={{ width: `${(batch.done / batch.total) * 100}%` }} /></div>
            {batch.done >= batch.total && batch.skipped.length > 0 && (
              <details style={{ marginTop: 6, fontSize: 12 }}>
                <summary>Pominięte ({batch.skipped.length})</summary>
                {batch.skipped.map((s, i) => <div key={i}>{s}</div>)}
              </details>
            )}
          </div>
        )}
        <div className="ws-list">
          {list.length === 0 && (
            <div className="empty" style={{ padding: 30 }}>
              {{ todo: 'Wszystko wysłane. Znajdź nowe firmy albo sprawdź, kto odpowiedział.', waiting: 'Nikt nie czeka na odpowiedź.', consent: 'Jeszcze nikt nie wyraził zgody.', all: 'Brak firm.' }[filter]}
            </div>
          )}
          {list.map((l) => {
            const step = nextStep(l, settings.followupDays);
            return (
              <div key={l.id} className={`ws-item ${active?.id === l.id ? 'active' : ''}`} onClick={() => setActiveId(l.id)}>
                <input type="checkbox" checked={checked.has(l.id)} onChange={() => toggle(l.id)} onClick={(e) => e.stopPropagation()} aria-label={`Zaznacz ${l.name}`} style={{ marginTop: 2 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="nm">{l.name}</div>
                  <small>
                    {[l.city, categoryLabel(l.category)].filter(Boolean).join(', ')}
                  </small>
                  <div className="row tight" style={{ marginTop: 4 }}>
                    <StatusBadge status={l.status} />
                    {step && step !== 'step1' && <span className="badge">{STEP_LABEL[step].split(':')[0]}</span>}
                    {!l.email && <span className="badge s-zgoda">bez e-maila</span>}
                    {(l.instagram || l.facebook || l.linkedin) && <span className="badge">social</span>}
                    {l.hook && <span className="badge">AI</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="ws-foot">
          <label>
            <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> Po wysłaniu otwieraj następną firmę
          </label>
          <small className="kbd-hint">
            <span className="kbd">J</span> następna, <span className="kbd">K</span> poprzednia
          </small>
        </div>
      </div>
      <div>{active ? <Composer
            key={active.id}
            lead={active}
            campaign={campaign}
            sender={sender}
            onOpenLead={() => onOpenLead(active.id)}
            nextName={autoNext ? next?.name : ''}
            onSent={() => autoNext && next && setActiveId(next.id)}
          /> : <div className="panel"><Empty title="Wybierz firmę z listy" /></div>}</div>
    </div>
  );
}

// ---------------- Firmy ----------------
function LeadsTable({ campaign, leads, onOpenLead }) {
  const { campaigns } = useStore();
  const [q, setQ] = useState('');
  const [checked, setChecked] = useState(new Set());
  const list = leads.filter((l) => !q || `${l.name} ${l.city} ${l.email}`.toLowerCase().includes(q.toLowerCase()));

  const addManual = () => {
    const [added] = addLeads(campaign.id, [{ name: 'Nowa firma', source: 'ręcznie', osmId: `manual/${Date.now()}` }]);
    if (added) onOpenLead(added.id);
  };

  return (
    <div className="panel flush">
      <div className="panel-head" style={{ flexWrap: 'wrap' }}>
        <input placeholder="Szukaj po nazwie, mieście, e-mailu" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <div className="spacer" />
        {checked.size > 0 && (
          <button className="btn danger" onClick={() => { if (confirm(`Usunąć ${checked.size} firm z kampanii?`)) { deleteLeads([...checked]); setChecked(new Set()); } }}>
            <Trash2 size={16} /> Usuń ({checked.size})
          </button>
        )}
        <button className="btn" onClick={addManual}><Plus size={16} /> Dodaj ręcznie</button>
        <button className="btn" onClick={() => downloadText(leadsToCsv(leads, campaigns), `${slug(campaign.name)}.csv`)}>
          <Download size={16} /> Eksport CSV
        </button>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Zaznacz wszystkie" onChange={(e) => setChecked(e.target.checked ? new Set(list.map((l) => l.id)) : new Set())} /></th>
              <th>Firma</th>
              <th>Etap</th>
              <th>E-mail</th>
              <th className="hide-sm">Telefon</th>
              <th className="hide-sm">Miasto</th>
              <th className="hide-sm">Źródło</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className={`clickable ${checked.has(l.id) ? 'sel' : ''}`} onClick={() => onOpenLead(l.id)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={checked.has(l.id)} onChange={() => setChecked((s) => { const n = new Set(s); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; })} aria-label={`Zaznacz ${l.name}`} />
                </td>
                <td className="nm">{l.name}<br /><small>{categoryLabel(l.category)}</small></td>
                <td><StatusBadge status={l.status} /></td>
                <td>{l.email || <small>—</small>}</td>
                <td className="hide-sm">{l.phone}</td>
                <td className="hide-sm">{l.city}</td>
                <td className="hide-sm"><small>{l.source}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="empty">Brak firm.</div>}
      </div>
    </div>
  );
}

// ---------------- Treści ----------------
const STEPS = ['step1', 'followup', 'step2', 'dm1'];
const STEP_HELP = {
  step1: 'Pierwszy kontakt. Tylko przedstawienie się i pytanie o zgodę – bez cen, rabatów i opisu oferty. Stopka {{klauzula}} jest wymagana.',
  followup: 'Jedno uprzejme przypomnienie po kilku dniach, nadal bez oferty.',
  step2: 'Właściwa oferta. Aplikacja pozwoli ją wysłać dopiero po odnotowaniu zgody. Elementy w [nawiasach] trzeba uzupełnić.',
  dm1: 'Krótka wersja na Instagram, Facebook i LinkedIn – też tylko pytanie o zgodę.',
};

function TemplatesEditor({ campaign, sender, sample }) {
  const [step, setStep] = useState('step1');
  const ref = useRef({});
  const tpl = step === 'dm1' ? { subject: '', body: campaign.templates.dm1 } : campaign.templates[step];
  const demo = sample || { name: 'Auto-Serwis Przykład', city: 'Gdańsk', category: campaign.categories[0] || 'warsztaty', source: 'osm', hook: '' };
  const preview = renderMessage(tpl, demo, sender, campaign);
  const issues = legalCheck(preview.body, step).filter((i) => !(step === 'step2' && i.text.startsWith('Do uzupełnienia')));
  const placeholders = legalCheck(preview.body, step).find((i) => i.text.startsWith('Do uzupełnienia'));

  const update = (patch) => {
    const t = { ...campaign.templates };
    if (step === 'dm1') t.dm1 = patch.body ?? t.dm1;
    else t[step] = { ...t[step], ...patch };
    saveCampaign({ ...campaign, templates: t });
  };

  const insert = (v) => {
    const el = ref.current.body;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const next = el.value.slice(0, start) + v + el.value.slice(el.selectionEnd ?? start);
    update({ body: next });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + v.length; });
  };

  return (
    <div className="stack lg">
      <div className="chips">
        {STEPS.map((s) => (
          <button key={s} className={`chip ${step === s ? 'on' : ''}`} onClick={() => setStep(s)}>{STEP_LABEL[s]}</button>
        ))}
      </div>
      <div className="notice info">{STEP_HELP[step]}</div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel stack">
          <h3>Szablon</h3>
          {step !== 'dm1' && (
            <Field label="Temat">
              <input value={tpl.subject} onChange={(e) => update({ subject: e.target.value })} />
            </Field>
          )}
          <Field label="Treść">
            <textarea ref={(el) => (ref.current.body = el)} className="mono" value={tpl.body} onChange={(e) => update({ body: e.target.value })} style={{ minHeight: 360 }} />
          </Field>
          <div>
            <small>Wstaw zmienną:</small>
            <div className="vars" style={{ marginTop: 6 }}>
              {VARIABLES.map(([v, d]) => (
                <button key={v} title={d} onClick={() => insert(v)}>{v}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="panel stack">
          <div className="row">
            <h3>Podgląd</h3>
            <div className="spacer" />
            <small>dla: {demo.name}</small>
          </div>
          {preview.subject && <div style={{ fontWeight: 600 }}>{preview.subject}</div>}
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, background: 'var(--panel-2)', padding: 14, borderRadius: 6, border: '1px solid var(--line)' }}>{preview.body}</div>
          <Issues issues={issues} />
          {step === 'step2' && placeholders && <div className="notice warn">{placeholders.text}. Uzupełnij je w szablonie albo przy każdej firmie przed wysyłką.</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------- Ustawienia kampanii ----------------
function CampaignSettings({ campaign }) {
  const { senders } = useStore();
  const set = (k) => (e) => saveCampaign({ ...campaign, [k]: e.target.value });
  const toggleCat = (id) => {
    const has = campaign.categories.includes(id);
    saveCampaign({ ...campaign, categories: has ? campaign.categories.filter((x) => x !== id) : [...campaign.categories, id] });
  };
  return (
    <div className="stack lg" style={{ maxWidth: 820 }}>
      <div className="panel stack">
        <div className="grid-2">
          <Field label="Nazwa kampanii">
            <input value={campaign.name} onChange={set('name')} />
          </Field>
          <Field label="Nadawca" hint="Zmiana nadawcy od razu podmienia podpis, stopkę RODO i nazwę firmy we wszystkich treściach.">
            <select value={campaign.senderId} onChange={set('senderId')}>
              <option value="">—</option>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Cel kampanii" hint="Używany przez AI przy personalizacji.">
          <textarea value={campaign.goal} onChange={set('goal')} style={{ minHeight: 60 }} />
        </Field>
        <Field label="Do kogo piszemy">
          <textarea value={campaign.audience} onChange={set('audience')} style={{ minHeight: 60 }} />
        </Field>
        <div>
          <small>Domyślne branże do wyszukiwania</small>
          <div className="chips" style={{ marginTop: 6 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`chip ${campaign.categories.includes(c.id) ? 'on' : ''}`} onClick={() => toggleCat(c.id)}>{c.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="panel row">
        <div style={{ flex: 1 }}>
          <h4>Usuń kampanię</h4>
          <small>Usuwa kampanię razem z jej firmami i historią. Lista wykluczeń zostaje.</small>
        </div>
        <button className="btn danger" onClick={() => { if (confirm('Usunąć kampanię i wszystkie jej firmy?')) { deleteCampaign(campaign.id); go('kampanie'); } }}>
          <Trash2 size={16} /> Usuń kampanię
        </button>
      </div>
    </div>
  );
}
