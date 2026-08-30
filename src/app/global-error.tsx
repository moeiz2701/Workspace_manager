'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>The app failed to start</h1>
        <p style={{ marginTop: '0.5rem', color: '#666' }}>{error.message}</p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid #ccc',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
