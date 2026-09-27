// Import i eksport kontaktów CSV (Excel w Polsce zapisuje ze średnikiem – obsługujemy oba).
import Papa from 'papaparse';
import { CATEGORIES, statusLabel, categoryLabel } from './defaults.js';

const ALIASES = {
  name: ['nazwa', 'firma', 'name', 'company', 'nazwa firmy'],
  email: ['email', 'e-mail', 'mail', 'adres email', 'adres e-mail'],
  phone: ['telefon', 'tel', 'phone', 'numer telefonu'],
  website: ['www', 'strona', 'website', 'url', 'strona www'],
  city: ['miasto', 'city', 'miejscowość', 'miejscowosc'],
  address: ['adres', 'address', 'ulica'],
  category: ['kategoria', 'branża', 'branza', 'category'],
  facebook: ['facebook', 'fb'],
  instagram: ['instagram', 'ig'],
  linkedin: ['linkedin', 'li'],
  notes: ['notatki', 'uwagi', 'notes'],
};

function mapHeader(h) {
  const k = h.trim().toLowerCase();
  for (const [field, list] of Object.entries(ALIASES)) if (list.includes(k)) return field;
  return null;
}

function guessCategory(v) {
  if (!v) return '';
  const s = v.toLowerCase();
  const direct = CATEGORIES.find((c) => c.id === s || c.label.toLowerCase() === s);
  if (direct) return direct.id;
  const partial = CATEGORIES.find((c) => c.label.toLowerCase().includes(s) || s.includes(c.id));
  return partial?.id || '';
}

export function parseLeadsCsv(text) {
  const res = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, delimitersToGuess: [';', ',', '\t'] });
  const leads = [];
  const unknown = new Set();
  for (const row of res.data) {
    const l = { source: 'csv' };
    for (const [h, v] of Object.entries(row)) {
      const f = mapHeader(h || '');
      if (!f) {
        if (h) unknown.add(h);
        continue;
      }
      l[f] = (v || '').toString().trim();
    }
    if (!l.name) continue;
    if (l.email) {
      l.email = l.email.toLowerCase();
      l.emails = [l.email];
    }
    if (l.website && !/^https?:\/\//i.test(l.website)) l.website = `https://${l.website}`;
    l.category = guessCategory(l.category);
    leads.push(l);
  }
  return { leads, unknownColumns: [...unknown] };
}

export function leadsToCsv(leads, campaigns = []) {
  const byId = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));
  const rows = leads.map((l) => ({
    Nazwa: l.name,
    Kampania: byId[l.campaignId] || '',
    Status: statusLabel(l.status),
    Zgoda: l.consent?.status || '',
    'Data zgody': l.consent?.date || '',
    'Kanał zgody': l.consent?.channel || '',
    Branża: categoryLabel(l.category),
    Email: l.email,
    Telefon: l.phone,
    WWW: l.website,
    Miasto: l.city,
    Adres: l.address,
    Facebook: l.facebook,
    Instagram: l.instagram,
    LinkedIn: l.linkedin,
    Źródło: l.source,
    Notatki: l.notes,
  }));
  return '﻿' + Papa.unparse(rows, { delimiter: ';' });
}

export function downloadText(text, filename, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
