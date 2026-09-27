import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../lib/store.js';
import { STATUSES, categoryLabel } from '../lib/defaults.js';
import { leadsToCsv, downloadText } from '../lib/csv.js';
import { StatusBadge, SenderChip, fmtDate } from '../components/ui.jsx';
import LeadDrawer from '../components/LeadDrawer.jsx';

export default function Contacts() {
  const { leads, campaigns, senders } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [open, setOpen] = useState(null);

  const byCampaign = useMemo(() => Object.fromEntries(campaigns.map((c) => [c.id, c])), [campaigns]);
  const list = useMemo(
    () =>
      leads.filter(
        (l) =>
          (!status || l.status === status) &&
          (!campaignId || l.campaignId === campaignId) &&
          (!q || `${l.name} ${l.city} ${l.email} ${l.website}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [leads, q, status, campaignId]
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kontakty</h1>
          <p>Wszystkie firmy ze wszystkich kampanii, z etapem rozmowy i zapisaną zgodą.</p>
        </div>
        <button className="btn" onClick={() => downloadText(leadsToCsv(list, campaigns), 'ktbmatic-kontakty.csv')}>
          <Download size={16} /> Eksport CSV ({list.length})
        </button>
      </div>
      <div className="panel flush">
        <div className="panel-head" style={{ flexWrap: 'wrap' }}>
          <input placeholder="Szukaj" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Wszystkie kampanie</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Każdy etap</option>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Etap</th>
                <th>Nadawca</th>
                <th>E-mail</th>
                <th className="hide-sm">Zgoda</th>
                <th className="hide-sm">Ostatni kontakt</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 500).map((l) => {
                const c = byCampaign[l.campaignId];
                return (
                  <tr key={l.id} className="clickable" onClick={() => setOpen(l.id)}>
                    <td className="nm">{l.name}<br /><small>{[l.city, categoryLabel(l.category)].filter(Boolean).join(', ')}</small></td>
                    <td><StatusBadge status={l.status} /></td>
                    <td><SenderChip sender={senders.find((s) => s.id === c?.senderId)} /><br /><small>{c?.name}</small></td>
                    <td>{l.email || <small>—</small>}</td>
                    <td className="hide-sm">{l.consent?.status === 'brak' ? <small>—</small> : <>{l.consent?.status}<br /><small>{l.consent?.date}</small></>}</td>
                    <td className="hide-sm"><small>{fmtDate(l.lastContactAt)}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">Brak kontaktów spełniających kryteria.</div>}
          {list.length > 500 && <div className="empty">Pokazano 500 z {list.length}. Zawęź wyszukiwanie.</div>}
        </div>
      </div>
      {open && <LeadDrawer leadId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
