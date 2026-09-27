// AI (Google Gemini – darmowy limit). Klucz:
//  • w Ustawieniach (zapisany tylko w tej przeglądarce) – zapytania idą prosto do Google,
//  • albo jako zmienna GEMINI_API_KEY na Netlify – zapytania idą przez funkcję /api/ai.
import { getState } from './store.js';
import { categoryLabel } from './defaults.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';

async function callGemini(prompt, { json = true, temperature = 0.7 } = {}) {
  const { geminiKey, geminiModel } = getState().settings;
  const model = geminiModel || 'gemini-flash-latest';
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  let text;
  if (geminiKey) {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`AI: ${data.error?.message || res.status}`);
    text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  } else {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, body }),
    });
    const isJson = (res.headers.get('content-type') || '').includes('json');
    if (res.status === 404 || !isJson) throw new Error('AI niedostępne: dodaj klucz Gemini w Ustawieniach albo GEMINI_API_KEY na Netlify.');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`AI: ${data.error || res.status}`);
    text = data.text || '';
  }
  if (!json) return text;
  try {
    return JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
  } catch {
    throw new Error('AI zwróciło nieczytelną odpowiedź. Spróbuj jeszcze raz.');
  }
}

export async function listModels() {
  const { geminiKey } = getState().settings;
  if (!geminiKey) throw new Error('Wpisz najpierw klucz Gemini.');
  const res = await fetch(`${API}/models?pageSize=100`, { headers: { 'x-goog-api-key': geminiKey } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Klucz nie działa.');
  return (data.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => /gemini/.test(n) && !/embedding|tts|image|audio|live/.test(n));
}

const LEGAL_RULES = `
ZASADY PRAWNE (Polska, Prawo komunikacji elektronicznej art. 398, RODO) – bezwzględne:
- Pierwsza wiadomość i przypomnienie NIE MOGĄ zawierać informacji handlowej: żadnych cen, rabatów, promocji, procentów, "oferty specjalnej", zachęt do zakupu, linków do sklepu.
- Pierwsza wiadomość: przedstawienie się, neutralny powód kontaktu, jedno pytanie o zgodę na przesłanie informacji, jasna możliwość odmowy.
- Nie wymyślaj faktów o odbiorcy ani o nadawcy. Używaj tylko danych podanych niżej. Jeśli czegoś nie wiesz – pomiń.
- Pisz po polsku, zwracaj się "Państwo", naturalnie, krótko, bez wykrzykników i bez emotikon (w DM dopuszczalny jeden).`;

// Zdanie personalizujące do wstawienia w {{personalizacja}}
export async function personalizeHook({ lead, sender, campaign }) {
  const prompt = `Jesteś doświadczonym handlowcem B2B w branży motoryzacyjnej.
Napisz JEDNO krótkie zdanie (maks. 25 słów), które nawiązuje do firmy odbiorcy i uzasadnia, dlaczego piszemy właśnie do niej.
Zdanie trafi do pierwszej wiadomości z prośbą o zgodę na kontakt, więc nie może niczego oferować ani sprzedawać.
${LEGAL_RULES}

NADAWCA: ${sender.company}${sender.actingAs ? ` (piszący: ${sender.actingAs})` : ''} – ${sender.shortDescription}
CEL KAMPANII: ${campaign.goal}
ODBIORCA: ${lead.name}; branża: ${categoryLabel(lead.category) || 'nieznana'}; miasto: ${lead.city || 'nieznane'}; adres: ${lead.address || '-'}; strona: ${lead.website || '-'}
O ODBIORCY (ze strony www, jeśli jest): ${(lead.about || '-').slice(0, 800)}

Zwróć JSON: {"hook": "zdanie"}`;
  const r = await callGemini(prompt, { temperature: 0.6 });
  return (r.hook || '').trim();
}

// Cała wiadomość przepisana przez AI dla konkretnej firmy (na bazie szablonu)
export async function rewriteMessage({ lead, sender, campaign, step, draft }) {
  const stepDesc = {
    step1: 'pierwsza wiadomość z prośbą o zgodę na przesłanie informacji (bez oferty)',
    followup: 'jedno uprzejme przypomnienie o pytaniu o zgodę (bez oferty)',
    step2: 'właściwa oferta – odbiorca wyraził zgodę na jej otrzymanie',
    dm1: 'krótka wiadomość na Instagramie/Facebooku/LinkedIn z prośbą o zgodę (maks. 400 znaków, bez oferty)',
  }[step];
  const prompt = `Popraw i dopasuj wiadomość do konkretnego odbiorcy. Rodzaj: ${stepDesc}.
${LEGAL_RULES}
- Zachowaj stopkę RODO i podpis bez zmian, jeśli występują.
- Zachowaj elementy w [nawiasach kwadratowych] – to miejsca do uzupełnienia przez człowieka.
- Ton: ${sender.tone || 'formalny'}.

NADAWCA: ${sender.company} – ${sender.shortDescription}. ${sender.about || ''}
CEL KAMPANII: ${campaign.goal}
ODBIORCA: ${lead.name}; branża: ${categoryLabel(lead.category)}; miasto: ${lead.city || '-'}; strona: ${lead.website || '-'}
O ODBIORCY: ${(lead.about || '-').slice(0, 800)}

OBECNA WERSJA:
TEMAT: ${draft.subject || ''}
TREŚĆ:
${draft.body}

Zwróć JSON: {"subject": "...", "body": "..."}${step === 'dm1' ? ' (subject zostaw pusty)' : ''}`;
  const r = await callGemini(prompt, { temperature: 0.5 });
  return { subject: r.subject || draft.subject || '', body: (r.body || draft.body || '').trim() };
}

// Propozycje firm do sprawdzenia (np. potencjalni sponsorzy) – bez danych kontaktowych,
// które AI mogłoby zmyślić. Kontakty uzupełnia się potem ze stron www.
export async function suggestProspects({ campaign, sender, count = 15, hint = '' }) {
  const prompt = `Zaproponuj ${count} realnie istniejących firm/marek działających w Polsce, które pasują do kampanii.
NADAWCA: ${sender.company} – ${sender.shortDescription}. ${sender.about || ''}
CEL: ${campaign.goal}
GRUPA DOCELOWA: ${campaign.audience}
${hint ? `DODATKOWE WSKAZÓWKI: ${hint}` : ''}
Nie podawaj adresów e-mail ani telefonów. Podaj tylko stronę www, jeśli jesteś jej pewien – w przeciwnym razie pusty string.
Zwróć JSON: {"firms": [{"name": "...", "website": "https://...", "city": "...", "why": "jedno zdanie, dlaczego pasuje"}]}`;
  const r = await callGemini(prompt, { temperature: 0.8 });
  return (r.firms || []).filter((f) => f.name);
}
