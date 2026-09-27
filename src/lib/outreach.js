// Wspólna logika wysyłki: przygotowanie treści, oznaczanie etapów i dzienne limity.
import { getState, updateLead, logEvent, isOptedOut } from './store.js';
import { renderMessage, legalCheck, hasBlockingIssues, STEP_LABEL } from './templates.js';
import { gmailCreateDraft, downloadEml } from './mail.js';

export function messageFor(lead, step, campaign, sender) {
  const saved = lead.drafts?.[step];
  if (saved) return saved;
  const tpl = step === 'dm1' ? { subject: '', body: campaign.templates.dm1 } : campaign.templates[step];
  return renderMessage(tpl, lead, sender, campaign);
}

export function stepAllowed(lead, step) {
  if (step === 'step2' && lead.consent?.status !== 'udzielona') return 'Oferta jest dostępna dopiero po odnotowaniu zgody odbiorcy.';
  if (lead.consent?.status === 'odmowa' || lead.status === 'odmowa') return 'Odbiorca odmówił kontaktu.';
  if (isOptedOut(lead)) return 'Adres jest na liście wykluczeń.';
  return null;
}

export function sentToday(senderId) {
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const l of getState().leads) for (const h of l.history || []) if (h.type === 'wysyłka' && h.senderId === senderId && h.date.slice(0, 10) === today) n++;
  return n;
}

const NEXT_STATUS = { step1: 'zapytanie', dm1: 'zapytanie', followup: 'przypomnienie', step2: 'oferta' };

// Kolejność etapów – wysyłka nigdy nie cofa kontaktu (np. DM po zgodzie nie zmieni „Zgoda” na „Zapytanie”)
const RANK = { nowy: 0, brak_odp: 0, zapytanie: 1, przypomnienie: 2, zgoda: 3, oferta: 4, rozmowy: 5, wygrany: 6 };

export function markSent(lead, step, channel, senderId) {
  const target = NEXT_STATUS[step];
  const current = getState().leads.find((l) => l.id === lead.id)?.status ?? lead.status;
  const status = (RANK[target] ?? 0) > (RANK[current] ?? 0) ? target : current;
  updateLead(lead.id, { status });
  logEvent(lead.id, { type: 'wysyłka', step, channel, senderId, contact: true, text: `${STEP_LABEL[step]}: ${channel}` });
}

// Tworzy szkic w Gmailu albo plik .eml. Zwraca opis kanału.
export async function sendEmail(lead, step, campaign, sender, mode = sender.mailMode) {
  const blocked = stepAllowed(lead, step);
  if (blocked) throw new Error(blocked);
  if (!lead.email) throw new Error(`${lead.name}: brak adresu e-mail.`);
  const msg = messageFor(lead, step, campaign, sender);
  const issues = legalCheck(msg.body, step);
  if (hasBlockingIssues(issues)) throw new Error(`${lead.name}: popraw treść przed wysyłką (${issues.find((i) => i.level === 'error').text})`);
  const payload = { fromName: sender.company, fromEmail: sender.email, to: lead.email, subject: msg.subject, body: msg.body };
  if (mode === 'gmail') {
    await gmailCreateDraft(sender.id, payload);
    markSent(lead, step, 'Gmail (szkic)', sender.id);
    return 'szkic w Gmailu';
  }
  downloadEml(payload, `${lead.name}-${step}`);
  markSent(lead, step, 'plik .eml', sender.id);
  return 'plik .eml';
}
