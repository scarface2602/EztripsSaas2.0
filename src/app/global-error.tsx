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
      <body style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '40px', textAlign: 'center', background: '#f8fafc' }}>
        <div style={{ maxWidth: '400px', margin: '80px auto', padding: '40px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', background: '#1e3a5f', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700 }}>E</span>
          </div>
          <h2 style={{ color: '#1e3a5f', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>{error.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={reset}
            style={{
              marginTop: '20px',
              padding: '10px 24px',
              background: '#1e3a5f',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
