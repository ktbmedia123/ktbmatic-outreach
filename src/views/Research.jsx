import { useCallback, useMemo, useState } from 'react';
import { Search, MapPin, Loader2, Plus, Upload, Sparkles, Mail, Globe, Phone, AtSign } from 'lucide-react';
import { useStore, addLeads, saveCampaign } from '../lib/store.js';
import { CATEGORIES, categoryLabel } from '../lib/defaults.js';
import { geocode, searchPlaces } from '../lib/osm.js';
import { parseLeadsCsv } from '../lib/csv.js';
import { suggestProspects } from '../lib/ai.js';
import { Field, Empty, SenderChip, go, toast } from '../components/ui.jsx';
import MapView from '../components/MapView.jsx';

export default function Research({ campaignId }) {
  const { campaigns, senders } = useStore();
  const active = campaigns.filter((c) => !c.archived);
  const campaign = campaigns.find((c) => c.id === campaignId) || null;
  const [tab, setTab] = useState('mapa');

  if (!active.length)
    return (
      <div className="panel">
        <Empty title="Najpierw utwórz kampanię" action={<button className="btn primary" onClick={() => go('kampanie/nowa')}><Plus size={16} /> Nowa kampania</button>}>
          Znalezione firmy trafiają zawsze do konkretnej kampanii – z konkretnym nadawcą.
        </Empty>
      </div>
    );

  const sender = senders.find((s) => s.id === campaign?.senderId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Znajdź firmy</h1>
          <p>Wyszukaj firmy w wybranym promieniu, wczytaj listę z pliku albo poproś AI o propozycje. Wybrane firmy trafią do kampanii.</p>
        </div>
      </div>
      <div className="panel row" style={{ marginBottom: 16 }}>
        <Field label="Dodawaj do kampanii">
          <select value={campaign?.id || ''} onChange={(e) => go(`research/${e.target.value}`)} style={{ minWidth: 300 }}>
            <option value="">— wybierz kampanię —</option>
            {active.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        {sender && <div style={{ alignSelf: 'flex-end', paddingBottom: 8 }}><SenderChip sender={sender} /></div>}
        <div className="spacer" />
        {campaign && <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={() => go(`kampania/${campaign.id}`)}>Przejdź do wysyłki</button>}
      </div>
      {!campaign ? (
        <div className="notice info">Wybierz kampanię, do której dodasz znalezione firmy.</div>
      ) : (
        <>
          <div className="tabs">
            {[['mapa', 'Z mapy'], ['csv', 'Import CSV'], ['ai', 'Propozycje AI']].map(([k, l]) => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === 'mapa' && <MapSearch key={campaign.id} campaign={campaign} />}
          {tab === 'csv' && <CsvImport campaign={campaign} />}
          {tab === 'ai' && <AiProspects campaign={campaign} sender={sender} />}
        </>
      )}
    </>
  );
}

function MapSearch({ campaign }) {
  const [query, setQuery] = useState(campaign.location?.label || '');
  const [places, setPlaces] = useState([]);
  const [center, setCenter] = useState(campaign.location || null);
  const [radius, setRadius] = useState(campaign.location?.radiusKm || 20);
  const [cats, setCats] = useState(campaign.categories.length ? campaign.categories : ['warsztaty']);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState('');
  const [onlyContact, setOnlyContact] = useState(false);

  async function findPlace(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy('geo');
    try {
      const r = await geocode(query);
      if (!r.length) toast('Nie znaleziono takiej lokalizacji.', 'err');
      setPlaces(r);
      if (r.length === 1) pickPlace(r[0]);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy('');
    }
  }

  function pickPlace(p) {
    setCenter(p);
    setQuery(p.label);
    setPlaces([]);
  }

  async function search() {
    setBusy('search');
    try {
      // „Szukaj firm” działa od razu po wpisaniu miasta – bez osobnego klikania „Wskaż”
      let where = center;
      if (!where || (query.trim() && query.trim() !== where.label)) {
        if (!query.trim()) throw new Error('Wpisz miasto albo adres.');
        const found = await geocode(query);
        if (!found.length) throw new Error('Nie znaleziono takiej lokalizacji.');
        where = found[0];
        setCenter(where);
        setQuery(where.label);
        setPlaces([]);
      }
      const r = await searchPlaces(cats, { ...where, radiusKm: radius });
      setResults(r);
      setSelected(new Set(r.filter((x) => x.email || x.website || x.facebook || x.instagram).map((x) => x.osmId)));
      saveCampaign({ ...campaign, location: { label: where.label, lat: where.lat, lon: where.lon, radiusKm: radius } });
      if (!r.length) toast('Brak firm w tym obszarze. Zwiększ promień albo dodaj branże.');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy('');
    }
  }

  const toggle = useCallback((id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const shown = useMemo(() => (results || []).filter((r) => !onlyContact || r.email || r.website || r.phone || r.facebook || r.instagram), [results, onlyContact]);

  const add = () => {
    const picked = results.filter((r) => selected.has(r.osmId));
    const added = addLeads(campaign.id, picked);
    toast(`Dodano ${added.length} firm${picked.length - added.length ? ` (pominięto ${picked.length - added.length} już dodanych)` : ''}.`);
    if (added.length) go(`kampania/${campaign.id}`);
  };

  const withEmail = (results || []).filter((r) => r.email).length;
  const withWww = (results || []).filter((r) => r.website).length;

  return (
    <div className="stack lg">
      <div className="panel stack">
        <div className="grid-2" style={{ alignItems: 'end' }}>
          <form onSubmit={findPlace} className="stack" style={{ gap: 6, position: 'relative' }}>
            <Field label="Lokalizacja" hint="Miasto, gmina albo adres, np. „Pruszcz Gdański” lub „Łódź, Elektronowa”.">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="np. Gdańsk" />
                <button className="btn" type="submit" disabled={busy === 'geo'}>
                  {busy === 'geo' ? <Loader2 size={16} className="spin" /> : <MapPin size={16} />} Wskaż
                </button>
              </div>
            </Field>
            {places.length > 1 && (
              <div className="panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, padding: 6, boxShadow: 'var(--shadow)' }}>
                {places.map((p, i) => (
                  <button key={i} type="button" className="btn ghost" style={{ width: '100%', justifyContent: 'flex-start', height: 'auto', padding: 8, whiteSpace: 'normal', textAlign: 'left' }} onClick={() => pickPlace(p)}>
                    {p.full}
                  </button>
                ))}
              </div>
            )}
          </form>
          <Field label={`Promień: ${radius} km`}>
            <input type="range" min="1" max="80" value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </Field>
        </div>
        <div>
          <small>Branże</small>
          <div className="chips" style={{ marginTop: 6 }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`chip ${cats.includes(c.id) ? 'on' : ''}`} onClick={() => setCats((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={search} disabled={(!center && !query.trim()) || !cats.length || busy === 'search'}>
            {busy === 'search' ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Szukaj firm
          </button>
          {center ? <small>środek: {center.label}, promień {radius} km</small> : <small>Wpisz miasto i kliknij „Szukaj firm”.</small>}
        </div>
      </div>

      <MapView center={center} radiusKm={radius} points={shown} selected={selected} onToggle={toggle} />

      {results && (
        <div className="panel flush">
          <div className="panel-head" style={{ flexWrap: 'wrap' }}>
            <h3>{results.length} firm</h3>
            <small>{withEmail} z e-mailem, {withWww} ze stroną www – brakujące e-maile pobierzesz ze stron w kampanii.</small>
            <div className="spacer" />
            <label className="row tight" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={onlyContact} onChange={(e) => setOnlyContact(e.target.checked)} /> tylko z danymi kontaktowymi
            </label>
            <button className="btn primary" disabled={!selected.size} onClick={add}>
              <Plus size={16} /> Dodaj zaznaczone ({selected.size})
            </button>
          </div>
          <div className="table-wrap" style={{ maxHeight: 520 }}>
            <table className="t">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" aria-label="Zaznacz wszystkie" checked={shown.length > 0 && shown.every((r) => selected.has(r.osmId))} onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((r) => r.osmId)) : new Set())} />
                  </th>
                  <th>Firma</th>
                  <th>Kontakt</th>
                  <th className="hide-sm">Adres</th>
                  <th>Odległość</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.osmId} className={`clickable ${selected.has(r.osmId) ? 'sel' : ''}`} onClick={() => toggle(r.osmId)}>
                    <td><input type="checkbox" checked={selected.has(r.osmId)} onChange={() => toggle(r.osmId)} onClick={(e) => e.stopPropagation()} aria-label={`Zaznacz ${r.name}`} /></td>
                    <td className="nm">{r.name}<br /><small>{categoryLabel(r.category)}</small></td>
                    <td>
                      <span className="ic-row">
                        <Mail size={15} className={r.email ? 'on' : ''} aria-label={r.email ? 'ma e-mail' : 'brak e-maila'} />
                        <Globe size={15} className={r.website ? 'on' : ''} aria-label={r.website ? 'ma stronę' : 'brak strony'} />
                        <Phone size={15} className={r.phone ? 'on' : ''} aria-label={r.phone ? 'ma telefon' : 'brak telefonu'} />
                        <AtSign size={15} className={r.facebook || r.instagram ? 'on' : ''} aria-label={r.facebook || r.instagram ? 'ma social media' : 'brak social media'} />
                      </span>
                      {r.email && <><br /><small>{r.email}</small></>}
                    </td>
                    <td className="hide-sm"><small>{r.address}</small></td>
                    <td>{r.distanceKm ?? '–'} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CsvImport({ campaign }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseLeadsCsv(text) : null), [text]);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('�')) t = new TextDecoder('windows-1250').decode(buf);
    setText(t);
  };

  const add = () => {
    const added = addLeads(campaign.id, parsed.leads);
    toast(`Dodano ${added.length} firm.`);
    if (added.length) go(`kampania/${campaign.id}`);
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="panel stack">
        <h3>Wczytaj plik lub wklej dane</h3>
        <p className="muted">
          Obsługiwane kolumny: nazwa, email, telefon, www, miasto, adres, branża, facebook, instagram, linkedin, notatki. Plik z Excela (średnik) i CSV z przecinkami działają tak samo. Dobre źródła: eksport z CEIDG, katalogi branżowe, lista klientów BIG-MOT.
        </p>
        <label className="btn" style={{ alignSelf: 'flex-start' }}>
          <Upload size={16} /> Wybierz plik CSV
          <input type="file" accept=".csv,text/csv,.txt" onChange={onFile} hidden />
        </label>
        <textarea className="mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={'nazwa;email;miasto;www\nAuto-Serwis Nowak;biuro@nowak.pl;Gdańsk;nowak.pl'} style={{ minHeight: 220 }} />
      </div>
      <div className="panel stack">
        <h3>Podgląd</h3>
        {!parsed ? (
          <small>Tu pojawią się wczytane firmy.</small>
        ) : (
          <>
            <p>
              Rozpoznano <b>{parsed.leads.length}</b> firm, {parsed.leads.filter((l) => l.email).length} z adresem e-mail.
            </p>
            {parsed.unknownColumns.length > 0 && <div className="notice warn">Pominięte kolumny: {parsed.unknownColumns.join(', ')}</div>}
            <div className="table-wrap" style={{ maxHeight: 300 }}>
              <table className="t">
                <thead><tr><th>Nazwa</th><th>E-mail</th><th>Miasto</th></tr></thead>
                <tbody>
                  {parsed.leads.slice(0, 50).map((l, i) => (
                    <tr key={i}><td>{l.name}</td><td>{l.email}</td><td>{l.city}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn primary" disabled={!parsed.leads.length} onClick={add}>
              <Plus size={16} /> Dodaj {parsed.leads.length} firm do kampanii
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AiProspects({ campaign, sender }) {
  const [hint, setHint] = useState('');
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await suggestProspects({ campaign, sender, hint });
      setItems(r);
      setSelected(new Set(r.map((_, i) => i)));
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const picked = items.filter((_, i) => selected.has(i)).map((f) => ({
      name: f.name,
      website: f.website || '',
      city: f.city || '',
      about: f.why || '',
      source: 'ai',
      osmId: `ai/${f.name.toLowerCase()}`,
    }));
    const added = addLeads(campaign.id, picked);
    toast(`Dodano ${added.length} firm. W kampanii kliknij „Pobierz dane ze stron”, żeby znaleźć ich e-maile.`);
    if (added.length) go(`kampania/${campaign.id}/firmy`);
  };

  return (
    <div className="stack lg">
      <div className="panel stack">
        <p className="muted">
          Przydatne, gdy odbiorców nie da się znaleźć na mapie – np. marki na sponsoring Tasiema albo producenci i dystrybutorzy. AI podaje tylko nazwy i strony www, bez adresów e-mail – te pobierzesz potem ze stron firm, więc nic nie jest zmyślone.
        </p>
        <Field label="Wskazówki (opcjonalnie)">
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="np. marki oponiarskie i olejowe, firmy z Pomorza, sklepy z tuningiem" />
        </Field>
        <div>
          <button className="btn primary" onClick={run} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Zaproponuj firmy
          </button>
        </div>
      </div>
      {items && (
        <div className="panel flush">
          <div className="panel-head">
            <h3>{items.length} propozycji</h3>
            <small>Sprawdź każdą przed wysyłką.</small>
            <div className="spacer" />
            <button className="btn primary" disabled={!selected.size} onClick={add}><Plus size={16} /> Dodaj ({selected.size})</button>
          </div>
          <div className="table-wrap">
            <table className="t">
              <tbody>
                {items.map((f, i) => (
                  <tr key={i} className={`clickable ${selected.has(i) ? 'sel' : ''}`} onClick={() => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
                    <td style={{ width: 30 }}><input type="checkbox" readOnly checked={selected.has(i)} aria-label={`Zaznacz ${f.name}`} /></td>
                    <td className="nm">{f.name}<br /><small>{f.why}</small></td>
                    <td>{f.website ? <a href={f.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{f.website.replace(/^https?:\/\/(www\.)?/, '')}</a> : <small>brak strony</small>}</td>
                    <td className="hide-sm"><small>{f.city}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
