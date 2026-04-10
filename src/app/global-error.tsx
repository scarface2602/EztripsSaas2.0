'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: 'system-ui', padding: '40px', textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p style={{ color: '#666' }}>{error.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={reset}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
