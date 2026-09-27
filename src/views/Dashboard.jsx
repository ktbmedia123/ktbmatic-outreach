import { useMemo } from 'react';
import { Plus, Search, Check } from 'lucide-react';
import { useServerStatus } from '../lib/status.js';
import { useStore } from '../lib/store.js';
import { STATUSES } from '../lib/defaults.js';
import { nextStep } from '../lib/templates.js';
import { sentToday } from '../lib/outreach.js';
import { SenderChip, go, Empty, plural } from '../components/ui.jsx';

const FUNNEL_COLORS = {
  nowy: ['#eef1f4', '#3d4550'],
  zapytanie: ['#dbe5ff', '#1f3f9e'],
  przypomnienie: ['#c9d7fd', '#1f3f9e'],
  zgoda: ['#ffe7a3', '#6b4600'],
  oferta: ['#e4d6ff', '#4b2390'],
  rozmowy: ['#d4c0fb', '#4b2390'],
  wygrany: ['#bfe6cf', '#14583a'],
};

export default function Dashboard() {
  const s = useStore();
  const { leads, campaigns, senders, settings } = s;

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((x) => [x.id, 0]));
    leads.forEach((l) => (c[l.status] = (c[l.status] || 0) + 1));
    return c;
  }, [leads]);

  const todo = useMemo(() => {
    const t = { step1: 0, followup: 0, step2: 0 };
    leads.forEach((l) => {
      const n = nextStep(l, settings.followupDays);
      if (n) t[n]++;
    });
    return t;
  }, [leads, settings.followupDays]);

  const active = campaigns.filter((c) => !c.archived);
  // kampania z największą liczbą zadań danego typu – tam prowadzi kliknięcie w „Do zrobienia”
  const bestCampaign = (step) => {
    let best = null, max = 0;
    for (const c of active) {
      const n = leads.filter((l) => l.campaignId === c.id && nextStep(l, settings.followupDays) === step).length;
      if (n > max) { max = n; best = c; }
    }
    return best;
  };
  const todoRow = (step) => {
    const c = bestCampaign(step);
    return c ? { className: 'todo link', role: 'button', tabIndex: 0, title: `Otwórz: ${c.name}`, onClick: () => go(`kampania/${c.id}`), onKeyDown: (e) => e.key === 'Enter' && go(`kampania/${c.id}`) } : { className: 'todo' };
  };
  const contacted = leads.filter((l) => l.status !== 'nowy').length;
  const consents = leads.filter((l) => l.consent?.status === 'udzielona').length;
  const funnelTotal = STATUSES.filter((x) => FUNNEL_COLORS[x.id]).reduce((a, x) => a + counts[x.id], 0);

  if (!campaigns.length)
    return (
      <>
        <div className="welcome">
          <img className="hero-logo" src="/ktbmatic-logo.png" alt="KTBmatic" />
          <p>
            Dzień dobry{settings.userName ? `, ${settings.userName}` : ''}. KTBmatic znajduje firmy, przygotowuje legalne pierwsze wiadomości w imieniu wybranego klienta i prowadzi rozmowę aż do oferty.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => go('kampanie/nowa')}>
              <Plus size={16} /> Utwórz pierwszą kampanię
            </button>
          </div>
        </div>
        <Setup state={s} />
        <HowItWorks />
      </>
    );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dzień dobry{settings.userName ? `, ${settings.userName}` : ''}</h1>
          <p>
            {plural(active.length, 'aktywna kampania', 'aktywne kampanie', 'aktywnych kampanii')}, {plural(leads.length, 'firma', 'firmy', 'firm')} w bazie, {contacted} z nich {contacted === 1 ? 'dostała' : 'dostało'} już wiadomość.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => go('research')}>
            <Search size={16} /> Znajdź firmy
          </button>
          <button className="btn primary" onClick={() => go('kampanie/nowa')}>
            <Plus size={16} /> Nowa kampania
          </button>
        </div>
      </div>

      <Setup state={s} />
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="panel flush">
          <div className="panel-head">
            <h3>Do zrobienia</h3>
          </div>
          <div {...todoRow('step1')}>
            <b>{todo.step1}</b>
            <div style={{ flex: 1 }}>
              Pierwszych wiadomości do wysłania
              <br />
              <small>zapytanie o zgodę, bez oferty</small>
            </div>
          </div>
          <div {...todoRow('followup')}>
            <b>{todo.followup}</b>
            <div style={{ flex: 1 }}>
              Przypomnień
              <br />
              <small>bez odpowiedzi od {settings.followupDays} dni</small>
            </div>
          </div>
          <div {...todoRow('step2')}>
            <b style={{ color: todo.step2 ? 'var(--amber)' : undefined }}>{todo.step2}</b>
            <div style={{ flex: 1 }}>
              Ofert do wysłania
              <br />
              <small>firmy, które wyraziły zgodę</small>
            </div>
          </div>
        </div>
        <div className="panel stack">
          <h3>Lejek</h3>
          <div className="row" style={{ gap: 28 }}>
            <div className="stat">
              <b>{contacted}</b>
              <span>skontaktowanych</span>
            </div>
            <div className="stat">
              <b>{consents}</b>
              <span>zgód</span>
            </div>
            <div className="stat">
              <b>{counts.wygrany}</b>
              <span>współprac</span>
            </div>
            <div className="stat">
              <b>{contacted ? Math.round((consents / contacted) * 100) : 0}%</b>
              <span>odsetek zgód</span>
            </div>
          </div>
          {funnelTotal > 0 && (
            <div className="funnel" aria-label="Rozkład etapów">
              {STATUSES.filter((x) => FUNNEL_COLORS[x.id] && counts[x.id]).map((x) => (
                <div key={x.id} title={`${x.label}: ${counts[x.id]}`} style={{ flex: counts[x.id], background: FUNNEL_COLORS[x.id][0], color: FUNNEL_COLORS[x.id][1] }}>
                  {counts[x.id]}
                </div>
              ))}
            </div>
          )}
          <div className="row tight">
            {STATUSES.filter((x) => FUNNEL_COLORS[x.id]).map((x) => (
              <span key={x.id} className="row tight" style={{ fontSize: 12, color: 'var(--muted)' }}>
                <span className="dot" style={{ background: FUNNEL_COLORS[x.id][0], border: '1px solid var(--line-strong)' }} />
                {x.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="panel flush">
        <div className="panel-head">
          <h3>Kampanie</h3>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Kampania</th>
                <th>Nadawca</th>
                <th>Firm</th>
                <th>Do wysłania</th>
                <th>Zgody</th>
                <th className="hide-sm">Dziś wysłano</th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => {
                const ls = leads.filter((l) => l.campaignId === c.id);
                const sender = senders.find((x) => x.id === c.senderId);
                return (
                  <tr key={c.id} className="clickable" onClick={() => go(`kampania/${c.id}`)}>
                    <td className="nm">{c.name}</td>
                    <td>
                      <SenderChip sender={sender} />
                    </td>
                    <td>{ls.length}</td>
                    <td>{ls.filter((l) => nextStep(l, settings.followupDays)).length}</td>
                    <td>{ls.filter((l) => l.consent?.status === 'udzielona').length}</td>
                    <td className="hide-sm">
                      {sender ? `${sentToday(sender.id)}/${settings.dailyLimit}` : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Setup({ state }) {
  const server = useServerStatus();
  const { settings, senders, campaigns, leads } = state;
  const usedSenders = senders.filter((s) => campaigns.some((c) => c.senderId === s.id));
  const sendersOk = (usedSenders.length ? usedSenders : senders.slice(0, 1)).every((s) => s.signerName && s.email && s.rodoAdmin);
  const steps = [
    { done: !!(settings.geminiKey || server?.ai), title: 'AI (Gemini)', text: 'personalizacja wiadomości', to: 'ustawienia' },
    { done: !!settings.googleClientId, title: 'Gmail', text: 'szkice w skrzynce nadawcy', to: 'ustawienia' },
    { done: sendersOk, title: 'Dane nadawców', text: 'podpis, e-mail, administrator RODO', to: 'nadawcy' },
    { done: campaigns.length > 0 && leads.length > 0, title: 'Pierwsza kampania', text: 'nadawca + firmy do kontaktu', to: campaigns.length ? `research/${campaigns[0].id}` : 'kampanie/nowa' },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <div className="panel flush" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h3>Przygotowanie</h3>
        <small>{steps.filter((s) => s.done).length} z {steps.length} gotowe</small>
      </div>
      <div className="setup">
        {steps.map((s) => (
          <button key={s.title} className={`setup-step ${s.done ? 'done' : ''}`} onClick={() => go(s.to)}>
            <span className="tick">{s.done && <Check size={14} strokeWidth={3} />}</span>
            <span>
              <b>{s.title}</b>
              <small>{s.text}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ['Nadawca', 'Wybierasz, w czyim imieniu piszesz: KTB Media, BIG-MOT, Grupa Janisz, Extreme, Qarmax albo nowy klient.'],
    ['Research', 'Wskazujesz miasto, promień i branże. Firmy przychodzą z mapy OpenStreetMap, z CSV albo z propozycji AI.'],
    ['Zapytanie o zgodę', 'Pierwsza wiadomość nie zawiera oferty – tylko prośbę o zgodę. Tak wymaga Prawo komunikacji elektronicznej.'],
    ['Oferta', 'Po odpowiedzi „Tak” odnotowujesz zgodę i dopiero wtedy wysyłasz ofertę.'],
  ];
  return (
    <div className="grid-2" style={{ marginTop: 16 }}>
      {steps.map(([t, d], i) => (
        <div className="panel" key={t}>
          <h3>
            {i + 1}. {t}
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>
            {d}
          </p>
        </div>
      ))}
    </div>
  );
}
