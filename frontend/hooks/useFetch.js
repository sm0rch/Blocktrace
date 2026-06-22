// ============================================================
// hooks/useFetch.js
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export function useFetch(apiFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // FIX: dùng ref để luôn gọi phiên bản mới nhất của apiFn
  // mà không cần đưa nó vào deps của useCallback (tránh infinite loop)
  const apiFnRef = useRef(apiFn);
  useEffect(() => { apiFnRef.current = apiFn; });

  // ⚠️ QUAN TRỌNG về deps:
  // Luôn truyền primitive values, KHÔNG truyền object/array reference.
  // Đúng:  useFetch(() => api(filters), [filters.a, filters.b])
  // Sai:   useFetch(() => api(filters), [filters])  ← object mới mỗi render → không re-fetch
  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFnRef.current();
      setData(result);
    } catch (err) {
      setError(err.message ?? 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { data, loading, error, refetch: execute };
}
