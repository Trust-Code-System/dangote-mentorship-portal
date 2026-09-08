'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Offline-resilient form state (experience-layer.md §1.15). Plant locations and
// low-bandwidth regions are a primary context, so a session log must never be
// lost to a dropped connection:
//   • values are mirrored to localStorage on every change (instant, survives a
//     reload or a closed tab even while offline),
//   • submit is connection-aware: if offline or the request fails, the payload
//     stays queued and is retried automatically when connectivity returns,
//   • a clear status indicator tells the user "saved locally" vs "synced".
// This is resilient forms, not a full offline-first PWA (explicitly out of scope).

export type SyncStatus = 'idle' | 'savedLocally' | 'syncing' | 'synced' | 'offline' | 'error';

export interface ResilientForm<T> {
  values: T;
  /** Merge a patch into the values and mirror to localStorage. */
  update: (patch: Partial<T>) => void;
  /** Replace all values (e.g. applying an AI suggestion) and mirror. */
  replace: (next: T) => void;
  status: SyncStatus;
  online: boolean;
  /** Attempt to submit now; queues + retries automatically if offline/failed. */
  submit: () => Promise<void>;
}

export function useOfflineForm<T extends Record<string, unknown>>(params: {
  storageKey: string;
  initial: T;
  onSubmit: (values: T) => Promise<{ ok: boolean }>;
  onSuccess?: () => void;
}): ResilientForm<T> {
  const { storageKey, initial, onSubmit, onSuccess } = params;
  const [values, setValues] = useState<T>(initial);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [online, setOnline] = useState(true);

  const valuesRef = useRef(values);
  const pending = useRef(false);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  // Hydrate any locally-saved draft and wire connectivity listeners once.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setValues((v) => ({ ...v, ...(JSON.parse(raw) as Partial<T>) }));
        setStatus('savedLocally');
      }
    } catch {
      // Corrupt draft — ignore and start clean.
    }
    setOnline(navigator.onLine);
    });
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [storageKey]);

  const persist = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage full / unavailable — submit still works; we just lose offline safety.
      }
    },
    [storageKey],
  );

  const update = useCallback(
    (patch: Partial<T>) => {
      setValues((v) => {
        const next = { ...v, ...patch };
        persist(next);
        return next;
      });
      setStatus('savedLocally');
    },
    [persist],
  );

  const replace = useCallback(
    (next: T) => {
      setValues(next);
      persist(next);
      setStatus('savedLocally');
    },
    [persist],
  );

  const submit = useCallback(async () => {
    if (!navigator.onLine) {
      pending.current = true;
      setStatus('offline');
      return;
    }
    setStatus('syncing');
    try {
      const res = await onSubmit(valuesRef.current);
      if (res.ok) {
        pending.current = false;
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        setStatus('synced');
        onSuccess?.();
      } else {
        setStatus('error');
      }
    } catch {
      // Network/transport failure — keep the draft and retry when back online.
      pending.current = true;
      setStatus('offline');
    }
  }, [onSubmit, onSuccess, storageKey]);

  // Retry a queued submit as soon as connectivity returns.
  useEffect(() => {
    if (online && pending.current) void submit();
  }, [online, submit]);

  return { values, update, replace, status, online, submit };
}
