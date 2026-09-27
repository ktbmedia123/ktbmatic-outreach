import { useState } from 'react';
import { Download, Upload, Trash2, Loader2, Plus, KeyRound } from 'lucide-react';
import { useStore, saveSettings, exportBackup, importBackup, resetAll, addOptout, removeOptout } from '../lib/store.js';
import { syncNow } from '../lib/sync.js';
import { listModels } from '../lib/ai.js';
import { downloadText } from '../lib/csv.js';
import { Field, toast, fmtDate } from '../components/ui.jsx';

export default function Settings() {
  const { settings, optout } = useStore();
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [newOpt, setNewOpt] = useState('');
  const set = (k, num) => (e) => saveSettings({ [k]: num ? Number(e.target.value) : e.target.value });

  const checkModels = async () => {
    setBusy(true);
    try {
      const m = await listModels();
      setModels(m);
      toast(`Klucz działa. Dostępnych modeli: ${m.length}.`);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      importBackup(await f.text());
      toast('Wczytano kopię zapasową.');
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ustawienia</h1>
          <p>Klucze usług, limity wysyłki, lista wykluczeń i kopia zapasowa. Dane są zapisane w tej przeglądarce – rób kopię przed zmianą komputera.</p>
        </div>
      </div>
      <div className="stack lg" style={{ maxWidth: 900 }}>
        <div className="panel stack">
          <h3>AI – Google Gemini (darmowy limit)</h3>
          <p className="muted">
            Klucz utworzysz bezpłatnie w <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>. Zapisany tutaj działa tylko w tej przeglądarce. Dla całego zespołu lepiej ustawić go na Netlify jako GEMINI_API_KEY – wtedy to pole zostaw puste.
          </p>
          <div className="grid-2">
            <Field label="Klucz API Gemini">
              <input type="password" value={settings.geminiKey} onChange={set('geminiKey')} placeholder="AIza…" autoComplete="off" />
            </Field>
            <Field label="Model" hint="„gemini-flash-latest” zawsze wskazuje aktualny szybki model.">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input value={settings.geminiModel} onChange={set('geminiModel')} list="models" />
                <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
                <button className="btn" onClick={checkModels} disabled={busy || !settings.geminiKey}>
                  {busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />} Sprawdź
                </button>
              </div>
            </Field>
          </div>
        </div>

        <div className="panel stack">
          <h3>Gmail – szkice wiadomości</h3>
          <p className="muted">
            Potrzebny jest identyfikator klienta OAuth z Google Cloud (bezpłatny, konfiguracja raz na 10 minut – instrukcja w README). Każdy nadawca loguje się swoim kontem Gmail lub Google Workspace, a KTBmatic tylko tworzy szkice – niczego nie wysyła sam.
          </p>
          <Field label="Google OAuth Client ID">
            <input value={settings.googleClientId} onChange={set('googleClientId')} placeholder="1234567890-abc.apps.googleusercontent.com" />
          </Field>
        </div>

        <div className="panel stack">
          <h3>Tempo wysyłki</h3>
          <div className="grid-2">
            <Field label="Dzienny limit e-maili na nadawcę" hint="Nowe skrzynki: 20–40 dziennie. Chroni domenę klienta przed filtrami spamu.">
              <input type="number" min="1" max="500" value={settings.dailyLimit} onChange={set('dailyLimit', true)} />
            </Field>
            <Field label="Przypomnienie po (dniach)">
              <input type="number" min="2" max="60" value={settings.followupDays} onChange={set('followupDays', true)} />
            </Field>
            <Field label="Twoje imię (powitanie na pulpicie)">
              <input value={settings.userName} onChange={set('userName')} />
            </Field>
          </div>
        </div>

        <div className="panel stack">
          <h3>Lista wykluczeń</h3>
          <p className="muted">Adresy i domeny, do których nie wolno pisać – z każdej kampanii i od każdego nadawcy. Odmowa odnotowana w kontakcie trafia tu automatycznie.</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input value={newOpt} onChange={(e) => setNewOpt(e.target.value)} placeholder="adres@firma.pl albo firma.pl" />
            <button className="btn" onClick={() => { addOptout(newOpt, 'dodane ręcznie'); setNewOpt(''); }} disabled={!newOpt.trim()}>
              <Plus size={16} /> Dodaj
            </button>
          </div>
          {optout.length > 0 && (
            <div className="table-wrap" style={{ maxHeight: 260 }}>
              <table className="t">
                <tbody>
                  {optout.map((o) => (
                    <tr key={o.value}>
                      <td className="nm">{o.value}</td>
                      <td><small>{o.reason}</small></td>
                      <td><small>{fmtDate(o.date)}</small></td>
                      <td style={{ width: 40 }}>
                        <button className="btn ghost sm icon" onClick={() => removeOptout(o.value)} aria-label={`Usuń ${o.value}`}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel stack">
          <h3>Kopia zapasowa</h3>
          <div className="row">
            <button className="btn" onClick={() => downloadText(exportBackup(), `ktbmatic-kopia-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}>
              <Download size={16} /> Pobierz kopię
            </button>
            <label className="btn">
              <Upload size={16} /> Wczytaj kopię
              <input type="file" accept="application/json,.json" onChange={onImport} hidden />
            </label>
            <div className="spacer" />
            <button className="btn danger" onClick={() => { if (confirm('Wyczyścić dane w tej przeglądarce? Wspólna baza zespołu zostanie i zaraz pobierze się ponownie.')) { resetAll(); syncNow(); } }}>
              <Trash2 size={16} /> Wyczyść tę przeglądarkę
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
