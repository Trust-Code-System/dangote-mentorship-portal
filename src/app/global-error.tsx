'use client';

import { useEffect } from 'react';

// Last-resort boundary for errors thrown in the ROOT layout itself. Renders
// OUTSIDE the normal layout, so it supplies its own <html>/<body> and avoids
// next-intl / design-system imports that could fail again.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          background: '#fff',
          color: '#111',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: '28rem', margin: 0, color: '#555' }}>
          An unexpected error occurred. Retry to reload this view, or go back.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: '2.75rem',
              padding: '0 1.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#0A6E13',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else window.location.href = '/';
            }}
            style={{
              height: '2.75rem',
              padding: '0 1.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #ccc',
              background: '#fff',
              color: '#111',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>
      </body>
    </html>
  );
}
