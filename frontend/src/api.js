import { useCallback, useEffect, useState } from 'react';

export const qs = (p) => {
  const s = new URLSearchParams(Object.entries(p || {}).filter(([, v]) => v !== '' && v != null)).toString();
  return s ? '?' + s : '';
};

async function pedir(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = 'Error de conexión con la API';
    try { msg = (await r.json()).error || msg; } catch { /* sin cuerpo JSON */ }
    throw new Error(msg);
  }
  return r.json();
}

export const get = (url, params) => pedir('/api' + url + qs(params));
export const post = (url, body) =>
  pedir('/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const put = (url, body) =>
  pedir('/api' + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const urlExcel = (tipo, params) => '/api/reportes/' + tipo + qs({ ...params, formato: 'xlsx' });
export const hoy = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

export function useGet(url, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const key = url + qs(params);
  const load = useCallback(() => {
    setLoading(true);
    get(url, params)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}
