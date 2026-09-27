import { useState } from 'react';
import { Plus, Archive, ArchiveRestore } from 'lucide-react';
import { useStore, createCampaignFromTemplate, saveCampaign } from '../lib/store.js';
import { CAMPAIGN_TEMPLATES } from '../lib/defaults.js';
import { nextStep } from '../lib/templates.js';
import { Modal, SenderChip, Field, Empty, go, fmtDate } from '../components/ui.jsx';

export default function Campaigns({ creating }) {
  const { campaigns, leads, senders, settings } = useStore();
  const [showArchived, setShowArchived] = useState(false);
  const list = campaigns.filter((c) => !!c.archived === showArchived);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kampanie</h1>
          <p>Każda kampania to jeden nadawca, jedna grupa odbiorców i komplet wiadomości: zapytanie o zgodę, przypomnienie, oferta i wersja na DM.</p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setShowArchived((x) => !x)}>
            {showArchived ? 'Pokaż aktywne' : 'Pokaż archiwum'}
          </button>
          <button className="btn primary" onClick={() => go('kampanie/nowa')}>
            <Plus size={16} /> Nowa kampania
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="panel">
          <Empty
            title={showArchived ? 'Archiwum jest puste' : 'Brak kampanii'}
            action={!showArchived && <button className="btn primary" onClick={() => go('kampanie/nowa')}><Plus size={16} /> Utwórz pierwszą</button>}
          >
            {showArchived ? 'Zarchiwizowane kampanie pojawią się tutaj.' : 'Zacznij od gotowego szablonu, np. „BIG-MOT → warsztaty w okolicy”.'}
          </Empty>
        </div>
      ) : (
        <div className="grid-3">
          {list.map((c) => {
            const sender = senders.find((s) => s.id === c.senderId);
            const ls = leads.filter((l) => l.campaignId === c.id);
            const todo = ls.filter((l) => nextStep(l, settings.followupDays)).length;
            const cons = ls.filter((l) => l.consent?.status === 'udzielona').length;
            return (
              <div key={c.id} className="panel sender-card" style={{ padding: 0 }}>
                <div className="livery" style={{ '--c': sender?.color || '#555', padding: '10px 16px' }}>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div className="as">jako</div>
                    <div className="who" style={{ fontSize: 20 }}>{sender?.company || 'brak nadawcy'}</div>
                  </div>
                </div>
                <div className="body">
                  <h3>{c.name}</h3>
                  <small>
                    {c.location?.label ? `${c.location.label}, ${c.location.radiusKm} km` : 'bez lokalizacji'} · od {fmtDate(c.createdAt)}
                  </small>
                  <div className="row" style={{ gap: 18 }}>
                    <div className="stat"><b style={{ fontSize: 28 }}>{ls.length}</b><span>firm</span></div>
                    <div className="stat"><b style={{ fontSize: 28 }}>{todo}</b><span>do wysłania</span></div>
                    <div className="stat"><b style={{ fontSize: 28 }}>{cons}</b><span>zgód</span></div>
                  </div>
                  <div className="row">
                    <button className="btn dark" onClick={() => go(`kampania/${c.id}`)}>Otwórz</button>
                    <div className="spacer" />
                    <button className="btn ghost icon" title={c.archived ? 'Przywróć' : 'Archiwizuj'} aria-label={c.archived ? 'Przywróć' : 'Archiwizuj'} onClick={() => saveCampaign({ ...c, archived: !c.archived })}>
                      {c.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && <NewCampaignModal onClose={() => go('kampanie')} senders={senders} />}
    </>
  );
}

function NewCampaignModal({ onClose, senders }) {
  const [tplKey, setTplKey] = useState(CAMPAIGN_TEMPLATES[1].key);
  const tpl = CAMPAIGN_TEMPLATES.find((t) => t.key === tplKey);
  const [senderId, setSenderId] = useState(tpl.senderId);
  const [name, setName] = useState(tpl.name);

  const pick = (t) => {
    setTplKey(t.key);
    if (t.senderId) setSenderId(t.senderId);
    setName(t.name);
  };

  const create = () => {
    const c = createCampaignFromTemplate(tplKey, { senderId: senderId || senders[0]?.id, name: name.trim() || tpl.name });
    go(`research/${c.id}`);
  };

  return (
    <Modal
      title="Nowa kampania"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Anuluj</button>
          <button className="btn primary" onClick={create}>Utwórz i znajdź firmy</button>
        </>
      }
    >
      <div className="stack lg">
        <div>
          <h4 style={{ marginBottom: 10 }}>Szablon</h4>
          <div className="tpl-grid">
            {CAMPAIGN_TEMPLATES.map((t) => {
              const s = senders.find((x) => x.id === t.senderId);
              return (
                <button key={t.key} className={`tpl ${tplKey === t.key ? 'on' : ''}`} onClick={() => pick(t)}>
                  <h4>{t.name}</h4>
                  <p>{t.goal || 'Własne treści od zera – z gotową strukturą zgodną z przepisami.'}</p>
                  {s && <SenderChip sender={s} />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid-2">
          <Field label="Nazwa kampanii">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Nadawca (w czyim imieniu piszesz)" hint="Szablon można użyć dla dowolnego klienta – treści podstawią jego dane.">
            <select value={senderId} onChange={(e) => setSenderId(e.target.value)}>
              {senders.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
