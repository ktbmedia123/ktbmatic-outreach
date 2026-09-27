import { LayoutDashboard, Flag, Search, Users, BadgeCheck, Settings as Cog, Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSession, renderSignInButton, signOut, installApiAuth } from './lib/auth.js';
import { startSync, stopSync, useSyncStatus, syncNow } from './lib/sync.js';
import { useStore, isOptedOut } from './lib/store.js';
import { nextStep } from './lib/templates.js';
import { Toasts, useHashRoute, go, plural } from './components/ui.jsx';
import Dashboard from './views/Dashboard.jsx';
import Campaigns from './views/Campaigns.jsx';
import CampaignView from './views/CampaignView.jsx';
import Research from './views/Research.jsx';
import Contacts from './views/Contacts.jsx';
import Senders from './views/Senders.jsx';
import Settings from './views/Settings.jsx';

const NAV = [
  ['', 'Pulpit', LayoutDashboard],
  ['kampanie', 'Kampanie', Flag],
  ['research', 'Znajdź firmy', Search],
  ['kontakty', 'Kontakty', Users],
  ['nadawcy', 'Nadawcy', BadgeCheck],
  ['ustawienia', 'Ustawienia', Cog],
];

installApiAuth();

export default function App() {
  const session = useSession();
  const clientId = useStore((s) => s.settings.googleClientId);
  useEffect(() => {
    if (session) startSync();
    else stopSync();
  }, [Boolean(session)]);
  if (!session) return <Login clientId={clientId} />;
  return <Shell session={session} />;
}

function Login({ clientId }) {
  const btn = useRef(null);
  const [error, setError] = useState('');
  const [denied, setDenied] = useState('');
  useEffect(() => {
    if (!btn.current) return;
    renderSignInButton(btn.current, clientId).catch((e) => setError(e.message));
  }, [clientId]);
  useEffect(() => {
    // serwer odrzucił konto (403) – pokaż komunikat
    const m = sessionStorage.getItem('ktbmatic:denied');
    if (m) setDenied(m);
  }, []);
  return (
    <div className="login">
      <div className="login-card">
        <img src="/ktbmatic-logo.png" alt="KTBmatic" className="login-logo" />
        <h1>Zaloguj się</h1>
        <p className="muted">Dostęp mają tylko konta zespołu KTB Media. Dane kampanii są wspólne dla wszystkich zalogowanych.</p>
        <div ref={btn} className="login-btn" />
        {error && <div className="notice warn">{error}</div>}
        {denied && <div className="notice warn">{denied}</div>}
      </div>
    </div>
  );
}

function SyncBadge({ session }) {
  const s = useSyncStatus();
  const time = s.at ? s.at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '';
  const label =
    s.state === 'error' ? 'Błąd zapisu' : s.state === 'pending' || s.state === 'sync' ? 'Zapisuję…' : s.at ? `Zapisano ${time}` : 'Łączę z bazą…';
  return (
    <div className="sync">
      <button className={`sync-btn ${s.state}`} onClick={syncNow} title={s.error || 'Wspólna baza zespołu – kliknij, żeby odświeżyć'}>
        {s.state === 'error' ? <CloudOff size={15} /> : s.state === 'pending' || s.state === 'sync' ? <RefreshCw size={15} className="spin" /> : <Cloud size={15} />}
        <span>{label}</span>
      </button>
      {s.state === 'error' && <small className="sync-err">{s.error}</small>}
      <div className="sync-user">
        <span title={session.email}>{session.name}</span>
        <button className="icon-btn" onClick={signOut} title="Wyloguj" aria-label="Wyloguj"><LogOut size={15} /></button>
      </div>
    </div>
  );
}

function Shell({ session }) {
  const [section = '', a, b] = useHashRoute();
  const { leads, settings, senders, optout } = useStore();
  const todo = leads.filter((l) => nextStep(l, settings.followupDays) && !isOptedOut(l, optout)).length;
  const navActive = section === 'kampania' ? 'kampanie' : section;

  useEffect(() => {
    const label = NAV.find(([p]) => p === navActive)?.[1];
    document.title = label && navActive ? `${label} – KTBmatic` : 'KTBmatic';
  }, [navActive]);

  let view;
  switch (section) {
    case 'kampanie':
      view = <Campaigns creating={a === 'nowa'} />;
      break;
    case 'kampania':
      view = <CampaignView id={a} tab={b} />;
      break;
    case 'research':
      view = <Research campaignId={a} />;
      break;
    case 'kontakty':
      view = <Contacts />;
      break;
    case 'nadawcy':
      view = <Senders editId={a} />;
      break;
    case 'ustawienia':
      view = <Settings />;
      break;
    default:
      view = <Dashboard />;
  }

  return (
    <div className="app">
      <aside className="side">
        <a className="brand" href="#/" aria-label="KTBmatic – pulpit">
          <img className="brand-mark" src="/logo-mark.svg" alt="" />
          <div>
            <div className="brand-name">KTB<span>matic</span></div>
            <div className="brand-sub">outreach KTB Media</div>
          </div>
        </a>
        <nav className="nav" aria-label="Główna nawigacja">
          {NAV.map(([path, label, Icon]) => (
            <button key={path} className={navActive === path ? 'active' : ''} onClick={() => go(path)} aria-current={navActive === path ? 'page' : undefined}>
              <Icon size={19} />
              <span className="lbl">{label}</span>
              {path === 'kampanie' && todo > 0 && <span className="count hot" title={`${todo} wiadomości czeka na wysłanie`}>{todo}</span>}
            </button>
          ))}
        </nav>
        <SyncBadge session={session} />
        <div className="side-foot">
          {plural(senders.length, 'nadawca', 'nadawcy', 'nadawców')}
          <br />
          Pierwszy kontakt zawsze bez oferty.
        </div>
      </aside>
      <main className="main">{view}</main>
      <Toasts />
    </div>
  );
}
