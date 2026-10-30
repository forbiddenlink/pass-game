import type { Metadata } from 'next';
import Link from 'next/link';
import { encode } from '@/lib/cipher';

export const metadata: Metadata = {
  title: 'No such file · PASS',
  robots: { index: false },
};

// The interrogator's note is enciphered with the game's own Caesar cipher,
// encoded at render time so the ciphertext can never drift from the engine.
const PLAIN = 'there is no such file in this room';
const CIPHER = encode(PLAIN, { type: 'caesar', shift: 3 });

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink px-6 py-16">
      {/* the lamp's cone of light, same warm-to-ink temperature as the room */}
      <div
        aria-hidden
        className="lamp-flicker pointer-events-none absolute inset-x-0 top-0 mx-auto h-[70%] w-[min(90vw,560px)] [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-ember) 34%, transparent), transparent 85%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, transparent 25%, var(--color-ink) 85%)' }}
      />

      <div className="relative flex w-full max-w-md flex-col gap-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-ash">file not found · 404</p>

        <p
          className="break-words font-[family-name:var(--font-mono)] text-lg uppercase tracking-[0.18em] text-ember"
        >
          {CIPHER}
        </p>

        <h1 className="font-[family-name:var(--font-display)] text-3xl italic leading-snug text-bone">
          There is no such file in this room.
        </h1>
        <p className="text-[14px] leading-relaxed text-bone-dim">
          The page you asked for is not here. The interrogator has stopped waiting, but the lamp is still on.
        </p>

        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center self-start text-[11px] font-medium uppercase tracking-widest text-ember underline-offset-4 hover:underline"
        >
          Back to the interrogation
        </Link>

        <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[0.34em] text-bone-dim/60">
          PASS
        </span>
      </div>
    </main>
  );
}
