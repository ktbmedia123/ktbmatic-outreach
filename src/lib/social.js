// Półautomatyczne wiadomości w social media: kopiujemy treść do schowka
// i otwieramy czat z firmą. Wysyłkę zatwierdza człowiek – zgodnie z zasadami Meta i LinkedIn.

function handleFrom(url, host) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!u.hostname.includes(host)) return '';
    const parts = u.pathname.split('/').filter(Boolean);
    if (host === 'facebook.com' && parts[0] === 'profile.php') return u.searchParams.get('id') || '';
    if (host === 'facebook.com' && parts[0] === 'pages' && parts.length >= 3) return parts[parts.length - 1];
    return parts[0] || '';
  } catch {
    return '';
  }
}

export function dmTargets(lead) {
  const out = [];
  if (lead.instagram) {
    const h = handleFrom(lead.instagram, 'instagram.com');
    out.push({ channel: 'Instagram', url: h ? `https://ig.me/m/${h}` : lead.instagram, profile: lead.instagram });
  }
  if (lead.facebook) {
    const h = handleFrom(lead.facebook, 'facebook.com');
    out.push({ channel: 'Facebook', url: h ? `https://m.me/${h}` : lead.facebook, profile: lead.facebook });
  }
  if (lead.linkedin) out.push({ channel: 'LinkedIn', url: lead.linkedin, profile: lead.linkedin });
  return out;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
