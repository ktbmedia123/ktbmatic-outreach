import { useState } from 'react';
import { Plus, Trash2, Copy, Link2 } from 'lucide-react';
import { useStore, saveSender, deleteSender, uid } from '../lib/store.js';
import { buildVars } from '../lib/templates.js';
import { gmailConnect, gmailConnectedAs } from '../lib/mail.js';
import { Livery, Field, Modal, go, toast } from '../components/ui.jsx';

const BLANK = {
  name: 'Nowy klient',
  company: '',
  actingAs: '',
  shortDescription: '',
  about: '',
  signerName: '',
  signerRole: '',
  email: '',
  phone: '',
  website: '',
  color: '#4A5568',
  tone: 'formalny',
  mailMode: 'gmail',
  rodoAdmin: '',
  rodoLink: '',
  signature: '{{imie_nadawcy}}\n{{rola}} | {{nadawca}}\n{{telefon}}\n{{www}}',
};

export default function Senders({ editId }) {
  const { senders, campaigns, settings } = useStore();
  const [, force] = useState(0);
  const editing = senders.find((s) => s.id === editId);

  const add = (base) => {
    const s = { ...(base || BLANK), id: uid('s'), name: base ? `${base.name} (kopia)` : BLANK.name };
    saveSender(s);
    go(`nadawcy/${s.id}`);
  };

  const connect = async (s) => {
    try {
      const email = await gmailConnect(s.id, settings.googleClientId, s.email);
      toast(`Połączono Gmail: ${email}`);
      force((x) => x + 1);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Nadawcy</h1>
          <p>Firmy, w imieniu których piszesz. Każda ma własny podpis, stopkę RODO i skrzynkę. Szablony kampanii działają z każdym nadawcą – wystarczy go podmienić.</p>
        </div>
        <button className="btn primary" onClick={() => add()}>
          <Plus size={16} /> Dodaj nadawcę
        </button>
      </div>
      <div className="grid-3">
        {senders.map((s) => {
          const used = campaigns.filter((c) => c.senderId === s.id).length;
          const missing = [!s.signerName && 'osoba podpisująca', !s.email && 'e-mail', !s.rodoAdmin && 'administrator RODO'].filter(Boolean);
          const conn = gmailConnectedAs(s.id);
          return (
            <div key={s.id} className="panel sender-card" style={{ padding: 0 }}>
              <Livery sender={s} label={s.name} />
              <div className="body">
                <small>{s.shortDescription || 'brak opisu'}</small>
                <div className="kv">
                  <dt>Podpisuje</dt><dd>{s.signerName || '—'}</dd>
                  <dt>Skrzynka</dt><dd>{s.email || '—'}</dd>
                  <dt>Wysyłka</dt><dd>{{ gmail: 'szkice w Gmailu', eml: 'pliki .eml', mailto: 'program pocztowy' }[s.mailMode]}</dd>
                  <dt>Kampanie</dt><dd>{used}</dd>
                </div>
                {missing.length > 0 && <div className="notice warn" style={{ fontSize: 13 }}>Uzupełnij: {missing.join(', ')}</div>}
                <div className="row tight">
                  <button className="btn dark sm" onClick={() => go(`nadawcy/${s.id}`)}>Edytuj</button>
                  {s.mailMode === 'gmail' && (
                    <button className="btn sm" onClick={() => connect(s)} title="Zaloguj konto Gmail tego nadawcy">
                      <Link2 size={14} /> {conn ? conn : 'Połącz Gmail'}
                    </button>
                  )}
                  <div className="spacer" />
                  <button className="btn ghost sm icon" onClick={() => add(s)} title="Duplikuj" aria-label="Duplikuj"><Copy size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editing && <SenderEditor sender={editing} used={campaigns.filter((c) => c.senderId === editing.id).length} onClose={() => go('nadawcy')} />}
    </>
  );
}

function SenderEditor({ sender, used, onClose }) {
  const [s, setS] = useState(sender);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const vars = buildVars({ source: 'osm' }, s, {});

  const save = () => {
    saveSender(s);
    toast('Zapisano nadawcę.');
    onClose();
  };

  return (
    <Modal
      title={s.name || 'Nadawca'}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            className="btn danger"
            disabled={used > 0}
            title={used ? 'Nadawca jest używany w kampaniach' : ''}
            onClick={() => { if (confirm('Usunąć nadawcę?')) { deleteSender(s.id); onClose(); } }}
          >
            <Trash2 size={16} /> Usuń
          </button>
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>Anuluj</button>
          <button className="btn primary" onClick={save}>Zapisz</button>
        </>
      }
    >
      <div className="stack lg">
        <Livery sender={s} />
        <div className="grid-2">
          <Field label="Nazwa robocza" hint="Widoczna tylko w KTBmatic.">
            <input value={s.name} onChange={set('name')} />
          </Field>
          <Field label="Firma (nadawca w wiadomościach)">
            <input value={s.company} onChange={set('company')} />
          </Field>
          <Field label="Występuje jako" hint="Opcjonalnie, np. „menedżer Łukasza Tasiemskiego”.">
            <input value={s.actingAs} onChange={set('actingAs')} />
          </Field>
          <Field label="Kolor marki">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input type="color" value={s.color} onChange={set('color')} />
              <input value={s.color} onChange={set('color')} />
            </div>
          </Field>
        </div>
        <Field label="Krótki opis (neutralny)" hint="Wstawiany jako {{opis_nadawcy}}. Bez słów sprzedażowych – np. „hurtownia części samochodowych z Pomorza”.">
          <input value={s.shortDescription} onChange={set('shortDescription')} />
        </Field>
        <Field label="Kontekst dla AI" hint="Co firma robi, co oferuje, czym się wyróżnia. AI korzysta z tego przy ofertach (krok 2), nigdy w pierwszej wiadomości.">
          <textarea value={s.about} onChange={set('about')} style={{ minHeight: 80 }} />
        </Field>
        <h4>Podpis i skrzynka</h4>
        <div className="grid-2">
          <Field label="Osoba podpisująca">
            <input value={s.signerName} onChange={set('signerName')} placeholder="Imię i nazwisko" />
          </Field>
          <Field label="Stanowisko">
            <input value={s.signerRole} onChange={set('signerRole')} />
          </Field>
          <Field label="E-mail nadawcy" hint="Konto Gmail / Google Workspace, na którym powstaną szkice.">
            <input type="email" value={s.email} onChange={set('email')} />
          </Field>
          <Field label="Telefon">
            <input value={s.phone} onChange={set('phone')} />
          </Field>
          <Field label="Strona www">
            <input value={s.website} onChange={set('website')} />
          </Field>
          <Field label="Sposób wysyłki e-maili">
            <select value={s.mailMode} onChange={set('mailMode')}>
              <option value="gmail">Szkice w Gmailu / Google Workspace</option>
              <option value="eml">Pliki .eml (Outlook, Thunderbird, poczta firmowa)</option>
              <option value="mailto">Otwórz w domyślnym programie pocztowym</option>
            </select>
          </Field>
          <Field label="Ton wiadomości">
            <select value={s.tone} onChange={set('tone')}>
              <option value="formalny">formalny</option>
              <option value="partnerski">partnerski</option>
              <option value="bezpośredni">bezpośredni</option>
            </select>
          </Field>
        </div>
        <Field label="Podpis" hint="Możesz używać zmiennych: {{imie_nadawcy}}, {{rola}}, {{nadawca}}, {{telefon}}, {{www}}. Puste linie znikną same.">
          <textarea className="mono" value={s.signature} onChange={set('signature')} style={{ minHeight: 90 }} />
        </Field>
        <h4>RODO</h4>
        <div className="grid-2">
          <Field label="Administrator danych" hint="Pełna nazwa firmy z adresem, np. „BIG-MOT Sp. z o.o., ul. …, Gdańsk”.">
            <input value={s.rodoAdmin} onChange={set('rodoAdmin')} />
          </Field>
          <Field label="Link do pełnej klauzuli (opcjonalnie)">
            <input value={s.rodoLink} onChange={set('rodoLink')} placeholder="https://…/polityka-prywatnosci" />
          </Field>
        </div>
        <div className="panel" style={{ background: 'var(--panel-2)' }}>
          <small>Podgląd podpisu i stopki</small>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginTop: 8 }}>
            {vars.podpis}
            {'\n\n---\n'}
            {vars.klauzula}
          </div>
        </div>
      </div>
    </Modal>
  );
}
