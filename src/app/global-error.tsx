'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-ink text-bone">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="font-serif text-3xl italic leading-snug">The lamp went out.</h1>
          <p className="text-[14px] leading-relaxed text-bone-dim">Something broke on our side. Try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] items-center text-[11px] font-medium uppercase tracking-widest text-ember underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
