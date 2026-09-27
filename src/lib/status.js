// Sprawdza jednorazowo, czy funkcje serwerowe (Netlify) są dostępne i skonfigurowane.
import { useEffect, useState } from 'react';

let cache;
export function fetchServerStatus() {
  if (!cache) {
    cache = fetch('/api/status')
      .then((r) => ((r.headers.get('content-type') || '').includes('json') ? r.json() : { ai: false, enrich: false }))
      .catch(() => ({ ai: false, enrich: false }));
  }
  return cache;
}

export function useServerStatus() {
  const [s, setS] = useState(null);
  useEffect(() => {
    fetchServerStatus().then(setS);
  }, []);
  return s;
}
