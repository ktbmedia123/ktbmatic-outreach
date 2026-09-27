// Szybkie testy logiki (bez przeglądarki): node scripts/test-logic.mjs
import assert from 'node:assert/strict';
import { CAMPAIGN_TEMPLATES, DEFAULT_SENDERS } from '../src/lib/defaults.js';
import { renderMessage, legalCheck, findPlaceholders } from '../src/lib/templates.js';
import { buildQuery, elementToLead } from '../src/lib/osm.js';
import { buildMime } from '../src/lib/mail.js';
import { extract } from '../netlify/functions/enrich.mjs';

const lead = { name: 'Auto-Serwis Kowalski', city: 'Pruszcz Gdański', category: 'warsztaty', source: 'osm', hook: '' };
let problems = 0;
for (const t of CAMPAIGN_TEMPLATES) {
  const sender = { ...(DEFAULT_SENDERS.find((s) => s.id === t.senderId) || DEFAULT_SENDERS[1]), signerName: 'Jan Nowak', phone: '500 600 700' };
  const c = { goal: t.goal, location: { label: 'Gdańsk' } };
  for (const step of ['step1', 'followup', 'dm1']) {
    const tpl = step === 'dm1' ? { body: t.templates.dm1 } : t.templates[step];
    const m = renderMessage(tpl, lead, sender, c);
    assert.ok(!/\{\{/.test(m.body + m.subject), `${t.key}/${step}: niewypełniona zmienna`);
    const issues = legalCheck(m.body, step).filter((i) => i.level === 'error' && !(t.key === 'pusta'));
    if (issues.length) { problems++; console.log('✗', t.key, step, issues.map((i) => i.text)); }
  }
}
const m = renderMessage(CAMPAIGN_TEMPLATES[1].templates.step1, lead, { ...DEFAULT_SENDERS[1], signerName: 'Jan Nowak' }, {});
console.log('--- przykład kroku 1 (BIG-MOT) ---\n' + m.subject + '\n\n' + m.body + '\n---');
assert.ok(legalCheck('Mamy rabat 20% i ceny od 99 zł', 'step1').filter((i) => i.level === 'error').length >= 3, 'lint wykrywa treści handlowe');
assert.deepEqual(findPlaceholders('a [link] b [do uzupełnienia]'), ['[link]', '[do uzupełnienia]']);

const q = buildQuery(['warsztaty', 'transport'], { lat: 54.27, lon: 18.63, radiusKm: 10 });
assert.ok(q.includes('around:10000,54.27,18.63') && q.includes('"shop"="car_repair"'));
const l = elementToLead({ type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'X', shop: 'car_repair', website: 'x.pl', 'contact:facebook': 'xserwis', 'addr:city': 'Gdańsk', 'addr:street': 'Długa', 'addr:housenumber': '5' } }, ['warsztaty']);
assert.equal(l.website, 'https://x.pl'); assert.equal(l.facebook, 'https://www.facebook.com/xserwis'); assert.equal(l.address, 'Długa 5, Gdańsk');

const html = `<title>Serwis X – naprawy</title><meta name="description" content="Warsztat w Gdańsku od 1998 roku">
<a href="mailto:biuro@serwisx.pl">mail</a> kontakt [at] serwisx.pl <img src="logo@2x.png">
<a href="tel:+48 58 123 45 67">tel</a> <a href="https://www.facebook.com/serwisx/">fb</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a> <a href="https://instagram.com/serwis_x">ig</a>
<a href="/kontakt">Kontakt</a> <span class="__cf_email__" data-cfemail="${cf('szef@serwisx.pl')}"></span>`;
function cf(s){ const k=0x42; return k.toString(16)+[...s].map(c=>(c.charCodeAt(0)^k).toString(16).padStart(2,'0')).join(''); }
const r = extract(html, 'https://serwisx.pl');
assert.deepEqual(r.emails.sort(), ['biuro@serwisx.pl', 'kontakt@serwisx.pl', 'szef@serwisx.pl']);
assert.equal(r.facebook, 'https://www.facebook.com/serwisx'); assert.equal(r.instagram, 'https://instagram.com/serwis_x');
assert.equal(r.phones[0], '+48581234567'); assert.deepEqual(r.contactLinks, ['https://serwisx.pl/kontakt']);

globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64');
const mime = buildMime({ fromName: 'BIG-MOT', fromEmail: 'a@b.pl', to: 'c@d.pl', subject: 'Współpraca – pytanie', body: 'Zażółć gęślą jaźń', unsent: true });
assert.ok(mime.includes('X-Unsent: 1') && mime.includes('=?UTF-8?B?'));
const bodyB64 = mime.split('\r\n\r\n')[1].replace(/\r\n/g, '');
assert.equal(Buffer.from(bodyB64, 'base64').toString('utf8'), 'Zażółć gęślą jaźń');

if (problems) { console.log(`\n${problems} szablon(y) z problemami`); process.exit(1); }
console.log('\n✓ Wszystkie testy logiki przeszły');

// Łączenie wyników z mapy i z Google
const { mergeLeads } = await import('../src/lib/search.js');
const merged = mergeLeads(
  [{ osmId: 'node/1', name: 'Auto Serwis Kowalski', city: 'Pruszcz Gdański', website: 'https://www.kowalski-auto.pl', source: 'osm', emails: [] }],
  [
    { osmId: 'web/a', name: 'Kowalski Auto Serwis', city: 'Pruszcz Gdański', website: 'kowalski-auto.pl', email: 'biuro@kowalski-auto.pl', emails: ['biuro@kowalski-auto.pl'], phone: '500600700', source: 'google' },
    { osmId: 'web/b', name: 'Wulkanizacja Nowak', city: 'Gdańsk', website: '', source: 'google', emails: [] },
  ],
);
assert.equal(merged.length, 2, 'ta sama strona www = ta sama firma');
assert.equal(merged[0].email, 'biuro@kowalski-auto.pl');
assert.deepEqual(merged[0].sources, ['osm', 'google']);
console.log('✓ łączenie wyników z mapy i Google');

// Wspólna baza: scalanie zmian z dwóch przeglądarek
const { mergeShared, stampChanges, toShared, applyShared } = await import('../src/lib/merge.js');
const T = Date.now();
const base = { senders: [], campaigns: [], leads: [], optout: [], settings: { dailyLimit: 40 }, deleted: {} };
const A = stampChanges(base, { ...base, leads: [{ id: 'l1', name: 'A', createdAt: '1' }] }, T + 1000);
const B = stampChanges(base, { ...base, leads: [{ id: 'l2', name: 'B', createdAt: '2' }] }, T + 1001);
let srv = mergeShared(toShared(A), toShared(B));
assert.equal(srv.leads.length, 2, 'dwie przeglądarki dodają różne firmy → obie zostają');
// A edytuje l1, B go usuwa później → usunięcie wygrywa
const A2 = stampChanges(A, { ...A, leads: [{ ...A.leads[0], name: 'A2' }] }, T + 2000);
const B2 = stampChanges(applyShared(B, srv), { ...applyShared(B, srv), leads: applyShared(B, srv).leads.filter((l) => l.id !== 'l1') }, T + 3000);
srv = mergeShared(mergeShared(srv, toShared(A2)), toShared(B2));
assert.deepEqual(srv.leads.map((l) => l.id), ['l2'], 'późniejsze usunięcie wygrywa z wcześniejszą edycją');
// nowsza edycja wygrywa ze starszą
const C1 = stampChanges(base, { ...base, campaigns: [{ id: 'c1', name: 'stara' }] }, T + 100);
const C2 = { ...C1, campaigns: [{ id: 'c1', name: 'nowa', _u: T + 200 }] };
assert.equal(mergeShared(toShared(C2), toShared(C1)).campaigns[0].name, 'nowa');
console.log('✓ scalanie wspólnej bazy');
