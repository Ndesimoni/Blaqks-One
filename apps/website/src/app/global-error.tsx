'use client';

export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: '10vh auto',
          maxWidth: 640,
          padding: 24,
          fontFamily: 'Arial, sans-serif',
          background: '#f8f7f3',
          color: '#172e27',
        }}
      >
        <h1>The website is temporarily unavailable.</h1>
        <p>Please try again shortly.</p>
        <button onClick={retry} style={{ padding: '12px 24px', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
