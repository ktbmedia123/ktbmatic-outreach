import { useEffect, useMemo, useState } from 'react';
import { Mail, FileDown, Copy, Sparkles, Wand2, RotateCcw, Instagram, Facebook, Linkedin, Check, Loader2, Send, Globe, ThumbsUp, ThumbsDown, Clock3, Pencil } from 'lucide-react';
import { Issues, StatusBadge, toast, todayIso, Field } from './ui.jsx';
import { ConsentForm } from './LeadDrawer.jsx';
import { updateLead, setConsent, logEvent, isOptedOut, otherContacts, useStore } from '../lib/store.js';
import { legalCheck, nextStep, STEP_LABEL } from '../lib/templates.js';
import { messageFor, stepAllowed, sendEmail, markSent, sentToday } from '../lib/outreach.js';
import { mailtoHref, gmailConnect, gmailConnectedAs } from '../lib/mail.js';
import { dmTargets, copyText } from '../lib/social.js';
import { personalizeHook, rewriteMessage } from '../lib/ai.js';
import { enrichWebsite, mergeEnrichment } from '../lib/enrich.js';
import { categoryLabel } from '../lib/defaults.js';

const ICONS = { Instagram, Facebook, LinkedIn: Linkedin };

export default function Composer({ lead, campaign, sender, onOpenLead, onSent, nextName }) {
  const state = useStore();
  const settings = state.settings;
  const suggested = nextStep(lead, settings.followupDays) || (lead.status === 'nowy' ? 'step1' : lead.consent?.status === 'udzielona' ? 'step2' : 'followup');
  const [step, setStep] = useState(suggested);
  const [busy, setBusy] = useState('');
  const [consentForm, setConsentForm] = useState(null);
  const [, force] = useState(0);

  useEffect(() => {
    setStep(suggested);
    setConsentForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const msg = messageFor(lead, step, campaign, sender);
  const dm = messageFor(lead, 'dm1', campaign, sender);
  const issues = useMemo(() => legalCheck(msg.body, step), [msg.body, step]);
  const dmIssues = useMemo(() => legalCheck(dm.body, 'dm1'), [dm.body]);
  const blocked = stepAllowed(lead, step);
  const optedOut = isOptedOut(lead, state.optout);
  const others = otherContacts(lead, state.leads);
  const targets = dmTargets(lead);
  const connected = gmailConnectedAs(sender.id);
  const today = sentToday(sender.id);
  const hasErrors = issues.some((i) => i.level === 'error');

  const editDraft = (s, patch) => updateLead(lead.id, (l) => ({ drafts: { ...l.drafts, [s]: { ...messageFor(l, s, campaign, sender), ...patch } } }));
  const resetDraft = (s) => updateLead(lead.id, (l) => { const d = { ...l.drafts }; delete d[s]; return { drafts: d }; });

  async function run(label, fn) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy('');
    }
  }

  const doEmail = (mode) =>
    run('email', async () => {
      if (mode === 'gmail' && !gmailConnectedAs(sender.id)) {
        await gmailConnect(sender.id, settings.googleClientId, sender.email);
        force((x) => x + 1);
      }
      const where = await sendEmail(lead, step, campaign, sender, mode);
      toast(mode === 'gmail' ? `${lead.name}: szkic gotowy w Gmailu (Szkice → Wyślij).` : `${lead.name}: pobrano ${where} – otwórz go w poczcie i wyślij.`);
      onSent?.();
    });

  const doMailto = () => {
    window.location.href = mailtoHref({ to: lead.email, subject: msg.subject, body: msg.body });
    markSent(lead, step, 'program pocztowy (mailto)', sender.id);
    onSent?.();
  };

  const doCopyEmail = async () => {
    await copyText(`${msg.subject}\n\n${msg.body}`);
    toast('Skopiowano temat i treść.');
  };

  const doDm = async (t) => {
    await copyText(dm.body);
    window.open(t.url, '_blank', 'noopener');
    toast(`Treść skopiowana. Wklej ją w czacie (${t.channel}) i wyślij, potem kliknij „Wysłałem”.`);
  };

  const confirmDm = (channel) => {
    markSent(lead, 'dm1', channel, sender.id);
    toast(`${lead.name}: odnotowano wiadomość (${channel}).`);
    onSent?.();
  };

  const doHook = () =>
    run('hook', async () => {
      let l = lead;
      if (!l.about && l.website) {
        try {
          const r = await enrichWebsite(l.website);
          const patch = mergeEnrichment(l, r);
          updateLead(l.id, patch);
          l = { ...l, ...patch };
        } catch {
          /* bez opisu też zadziała */
        }
      }
      const hook = await personalizeHook({ lead: l, sender, campaign });
      updateLead(l.id, { hook });
      resetDraft(step);
      resetDraft('dm1');
      toast('Dodano zdanie personalizujące.');
    });

  const doRewrite = () =>
    run('rewrite', async () => {
      const r = await rewriteMessage({ lead, sender, campaign, step, draft: msg });
      editDraft(step, r);
      toast('AI przygotowało nową wersję – sprawdź ją przed wysyłką.');
    });

  const doEnrich = () =>
    run('enrich', async () => {
      const r = await enrichWebsite(lead.website);
      updateLead(lead.id, mergeEnrichment(lead, r));
      toast(r.emails?.length ? `Znaleziono: ${r.emails.join(', ')}` : 'Strona nie podaje adresu e-mail.');
    });

  const saveConsent = () => {
    setConsent(lead.id, consentForm);
    if (consentForm.status === 'udzielona') setStep('step2');
    setConsentForm(null);
  };

  const modeLabel = { gmail: 'Utwórz szkic w Gmailu', eml: 'Pobierz gotowy e-mail (.eml)', mailto: 'Otwórz w programie pocztowym' }[sender.mailMode] || 'Utwórz szkic';
  const emailDisabled = !!blocked || optedOut || !lead.email || hasErrors || !!busy;

  return (
    <div className="stack lg">
      {/* Nagłówek kontaktu */}
      <div className="panel">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="stack" style={{ gap: 4, minWidth: 0, flex: 1 }}>
            <div className="row">
              <h2 style={{ fontSize: 26 }}>{lead.name}</h2>
              <StatusBadge status={lead.status} />
            </div>
            <small>
              {[categoryLabel(lead.category), lead.address || lead.city, lead.distanceKm ? `${lead.distanceKm} km` : ''].filter(Boolean).join(' · ')}
            </small>
            <div className="row tight" style={{ marginTop: 4 }}>
              {lead.email ? <span className="badge">{lead.email}</span> : <span className="badge s-zgoda">brak e-maila</span>}
              {lead.phone && <span className="badge">{lead.phone}</span>}
              {lead.website && (
                <a className="badge" href={lead.website} target="_blank" rel="noreferrer">
                  {lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              )}
            </div>
          </div>
          <div className="row tight">
            {lead.website && (
              <button className="btn sm" onClick={doEnrich} disabled={!!busy} title="Pobierz e-mail, telefon i social media ze strony">
                {busy === 'enrich' ? <Loader2 size={15} className="spin" /> : <Globe size={15} />} Pobierz dane ze strony
              </button>
            )}
            <button className="btn sm" onClick={onOpenLead}>
              <Pencil size={15} /> Edytuj
            </button>
          </div>
        </div>
        {optedOut && <div className="notice err" style={{ marginTop: 12 }}>Adres jest na liście wykluczeń. Wysyłka zablokowana.</div>}
        {others.length > 0 && (
          <div className="notice warn" style={{ marginTop: 12 }}>
            Ta firma jest już w kontakcie w innej kampanii ({others.length}). Upewnij się, że nie piszecie do niej z dwóch stron.
          </div>
        )}
      </div>

      {/* Odpowiedź odbiorcy */}
      {['zapytanie', 'przypomnienie'].includes(lead.status) && !consentForm && (
        <div className="panel row">
          <div style={{ flex: 1, minWidth: 220 }}>
            <h4>Czy firma odpowiedziała?</h4>
            <small>Odnotuj odpowiedź – zgoda odblokuje wysyłkę oferty.</small>
          </div>
          <button className="btn" onClick={() => setConsentForm({ status: 'udzielona', date: todayIso(), channel: 'e-mail', note: '' })}>
            <ThumbsUp size={16} /> Zgoda
          </button>
          <button className="btn" onClick={() => setConsentForm({ status: 'odmowa', date: todayIso(), channel: 'e-mail', note: '' })}>
            <ThumbsDown size={16} /> Odmowa
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              updateLead(lead.id, { status: 'brak_odp' });
              logEvent(lead.id, { type: 'status', text: 'Zamknięty: brak odpowiedzi' });
            }}
          >
            <Clock3 size={16} /> Brak odpowiedzi
          </button>
        </div>
      )}
      {consentForm && (
        <div className="panel">
          <h4>{consentForm.status === 'udzielona' ? 'Odnotuj zgodę' : 'Odnotuj odmowę'}</h4>
          <ConsentForm value={consentForm} onChange={setConsentForm} onSave={saveConsent} onCancel={() => setConsentForm(null)} />
        </div>
      )}

      {/* E-mail */}
      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3>E-mail</h3>
          <div className="spacer" />
          <div className="chips" role="tablist">
            {['step1', 'followup', 'step2'].map((s) => (
              <button key={s} className={`chip ${step === s ? 'on' : ''}`} onClick={() => setStep(s)} role="tab" aria-selected={step === s}>
                {STEP_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        {blocked ? (
          <div className="notice warn">{blocked}</div>
        ) : (
          <div className="stack">
            <div className="msg-box">
              <input value={msg.subject} onChange={(e) => editDraft(step, { subject: e.target.value })} aria-label="Temat" />
              <textarea className="auto" value={msg.body} onChange={(e) => editDraft(step, { body: e.target.value })} aria-label="Treść" />
            </div>
            <div className="row tight">
              <button className="btn sm" onClick={doHook} disabled={!!busy} title="AI dopisze jedno zdanie o tej firmie">
                {busy === 'hook' ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Personalizuj (AI)
              </button>
              <button className="btn sm" onClick={doRewrite} disabled={!!busy}>
                {busy === 'rewrite' ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />} Przepisz pod firmę (AI)
              </button>
              {lead.drafts?.[step] && (
                <button className="btn sm ghost" onClick={() => resetDraft(step)}>
                  <RotateCcw size={15} /> Przywróć szablon
                </button>
              )}
            </div>
            <Issues issues={issues} okText={step === 'step2' ? 'Gotowe do wysłania – odbiorca wyraził zgodę.' : 'Treść nie zawiera oferty – można wysłać jako pierwszy kontakt.'} />
            <div className="row send-bar">
              <button className="btn primary" disabled={emailDisabled} onClick={() => (sender.mailMode === 'mailto' ? doMailto() : doEmail(sender.mailMode))}>
                {busy === 'email' ? <Loader2 size={16} className="spin" /> : sender.mailMode === 'eml' ? <FileDown size={16} /> : <Mail size={16} />}
                {modeLabel}
              </button>
              {sender.mailMode !== 'eml' && (
                <button className="btn" disabled={emailDisabled} onClick={() => doEmail('eml')} title="Plik otworzy się jako nowa wiadomość w Outlooku lub Thunderbirdzie">
                  <FileDown size={16} /> .eml
                </button>
              )}
              <button className="btn icon" onClick={doCopyEmail} title="Kopiuj temat i treść" aria-label="Kopiuj">
                <Copy size={16} />
              </button>
              <div className="spacer" />
              <small title={nextName ? `Po wysłaniu otworzy się: ${nextName}` : ''}>
                {sender.mailMode === 'gmail' && (connected ? `Gmail: ${connected}, ` : 'Gmail: połączysz przy pierwszej wysyłce, ')}
                dziś {today} z {settings.dailyLimit}
                {nextName && <><br />dalej: {nextName}</>}
              </small>
            </div>
            {today >= settings.dailyLimit && <div className="notice warn">Osiągnięto dzienny limit dla tego nadawcy. Kolejne wiadomości wyślij jutro – to chroni domenę przed filtrami spamu.</div>}
          </div>
        )}
      </div>

      {/* DM */}
      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3>Instagram, Facebook, LinkedIn</h3>
          <div className="spacer" />
          <small>kopiujesz treść, czat otwiera się w nowej karcie, wysyłasz sam</small>
        </div>
        {stepAllowed(lead, 'dm1') ? (
          <div className="notice warn">{stepAllowed(lead, 'dm1')}</div>
        ) : lead.consent?.status === 'udzielona' ? (
          <div className="notice info">
            Firma już wyraziła zgodę, więc prośba o zgodę jest zbędna. Wyślij ofertę e-mailem (krok 2) albo skopiuj jej treść do czatu, w którym rozmawiacie.
            <div className="row" style={{ marginTop: 10 }}>
              {targets.map((t) => (
                <button key={t.channel} className="btn sm" onClick={async () => { const m = messageFor(lead, 'step2', campaign, sender); const err = legalCheck(m.body, 'step2').find((i) => i.level === 'error'); if (err) return toast(`Uzupełnij ofertę w kroku 2: ${err.text}`, 'err'); await copyText(m.body); window.open(t.url, '_blank', 'noopener'); toast('Skopiowano treść oferty.'); }}>
                  Kopiuj ofertę i otwórz {t.channel}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="stack">
            <textarea value={dm.body} onChange={(e) => editDraft('dm1', { subject: '', body: e.target.value })} style={{ minHeight: 110 }} aria-label="Treść wiadomości DM" />
            <Issues issues={dmIssues} okText="Krótka prośba o zgodę – bez oferty." />
            {targets.length === 0 ? (
              <small>Brak profili social media. Dodaj je w edycji kontaktu albo pobierz ze strony www.</small>
            ) : (
              targets.map((t) => {
                const Icon = ICONS[t.channel] || Send;
                return (
                  <div className="row" key={t.channel}>
                    <button className="btn" onClick={() => doDm(t)} disabled={dmIssues.some((i) => i.level === 'error')}>
                      <Icon size={16} /> Kopiuj i otwórz {t.channel}
                    </button>
                    <button className="btn ghost sm" onClick={() => confirmDm(t.channel)}>
                      <Check size={15} /> Wysłałem
                    </button>
                    <a className="muted" href={t.profile} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                      profil
                    </a>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
