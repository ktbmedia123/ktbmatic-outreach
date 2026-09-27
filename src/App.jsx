import { LayoutDashboard, Flag, Search, Users, BadgeCheck, Settings as Cog } from 'lucide-react';
import { useEffect } from 'react';
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

export default function App() {
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
