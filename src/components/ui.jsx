import { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { statusLabel } from '../lib/defaults.js';

// ---------- Powiadomienia ----------
const toastListeners = new Set();
export function toast(text, type = 'ok') {
  const t = { id: Math.random(), text, type };
  toastListeners.forEach((l) => l(t));
}

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (t) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.type === 'err' ? 7000 : 3500);
    };
    toastListeners.add(on);
    return () => toastListeners.delete(on);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type === 'err' ? 'err' : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------- Okna ----------
function useEsc(onClose) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEsc(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <div className="spacer" />
          <button className="btn ghost icon" onClick={onClose} aria-label="Zamknij">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }) {
  useEsc(onClose);
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <div className="spacer" />
          <button className="btn ghost icon" onClick={onClose} aria-label="Zamknij">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </aside>
    </>
  );
}

// ---------- Drobne elementy ----------
export function StatusBadge({ status }) {
  return <span className={`badge s-${status}`}>{statusLabel(status)}</span>;
}

export function SenderChip({ sender }) {
  if (!sender) return <span className="muted">brak nadawcy</span>;
  return (
    <span className="livery-chip" style={{ '--c': sender.color }}>
      <i />
      {sender.name}
    </span>
  );
}

export function Livery({ sender, right, label = 'Piszesz jako' }) {
  if (!sender) return <div className="notice warn">Wybierz nadawcę kampanii.</div>;
  return (
    <div className="livery" style={{ '--c': sender.color }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="as">{label}</div>
        <div className="who">{sender.company || sender.name}</div>
        <div className="role">
          {[sender.signerName || 'uzupełnij osobę podpisującą', sender.actingAs || sender.signerRole].filter(Boolean).join(', ')}
        </div>
      </div>
      <div className="spacer" />
      {right && <div className="livery-right">{right}</div>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Issues({ issues, okText = 'Treść wygląda poprawnie.' }) {
  if (!issues.length)
    return (
      <div className="issue ok">
        <CheckCircle2 size={16} />
        {okText}
      </div>
    );
  return (
    <div className="issues">
      {issues.map((i, n) => (
        <div key={n} className={`issue ${i.level}`}>
          {i.level === 'error' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
          {i.text}
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

// Odmiana liczebników: plural(5, 'firma', 'firmy', 'firm') → „5 firm”
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  const w = n === 1 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${w}`;
}

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
export const todayIso = () => new Date().toISOString().slice(0, 10);

// Proste przełączanie widoków przez hash w adresie (#/kampania/abc)
export function useHashRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '').split('/');
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const h = () => setRoute(get());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}
export const go = (path) => {
  window.location.hash = `/${path}`;
  window.scrollTo(0, 0);
};
