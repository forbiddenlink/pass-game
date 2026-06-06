import React from 'react';
import { AbsoluteFill, Series, interpolate, useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Fraunces';

const { fontFamily: serif } = loadFont();
const MONO = 'ui-monospace, SFMono-Regular, monospace';

const INK = '#0c0a10';
const BONE = '#efe6d4';
const DIM = '#c8bca6';
const EMBER = '#f0a338';
const ASH = '#8a8194';

const GL = 'abcdefghijklmnopqrstuvwxyz';
function decrypt(target: string, frame: number, start: number, step = 2) {
  return target
    .split('')
    .map((ch, i) => {
      if (ch === ' ') return ' ';
      if (frame < start) return ' ';
      const lock = start + 10 + i * step;
      if (frame >= lock) return ch;
      return GL[(frame * 5 + i * 7) % 26];
    })
    .join('');
}
const typed = (text: string, frame: number, start: number, speed = 1.6) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) / speed)));

const fade = (frame: number, inAt: number, outAt: number) =>
  interpolate(frame, [inAt, inAt + 18, outAt - 18, outAt], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const Frame: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = INK }) => (
  <AbsoluteFill style={{ backgroundColor: bg, fontFamily: serif, padding: 96, justifyContent: 'center' }}>{children}</AbsoluteFill>
);

const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const glow = interpolate(f, [0, 40], [0, 0.5], { extrapolateRight: 'clamp' });
  return (
    <Frame>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 50% 60% at 50% 0%, rgba(244,178,88,${glow}), transparent 70%)` }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ fontStyle: 'italic', fontSize: 44, color: BONE, opacity: fade(f, 12, 170) }}>Manchester. The longest day, 1952.</div>
        <div style={{ fontStyle: 'italic', fontSize: 44, color: BONE, opacity: fade(f, 70, 170) }}>They have brought you in to decide what you are.</div>
      </div>
    </Frame>
  );
};

const CipherScene: React.FC = () => {
  const f = useCurrentFrame();
  const text = decrypt('what does the longest day mean to you', f, 20, 3);
  return (
    <Frame>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 6, textTransform: 'uppercase', color: ASH, marginBottom: 22, opacity: fade(f, 0, 180) }}>intercept · enciphered</div>
      <div style={{ fontFamily: MONO, fontSize: 36, letterSpacing: 4, color: EMBER, opacity: fade(f, 0, 180) }}>{text}</div>
      <div style={{ fontStyle: 'italic', fontSize: 26, color: DIM, marginTop: 40, opacity: fade(f, 96, 180) }}>First, break the cipher.</div>
    </Frame>
  );
};

const ExchangeScene: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <div style={{ fontStyle: 'italic', fontSize: 46, color: BONE, opacity: fade(f, 0, 300) }}>&ldquo;What does the longest day mean to you?&rdquo;</div>
        <div style={{ fontSize: 30, color: DIM, opacity: interpolate(f, [60, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          {typed('honestly... the dark is coming, and i am not ready.', f, 60)}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: 5, textTransform: 'uppercase', color: ASH, opacity: fade(f, 190, 300) }}>the interrogator · a real AI</div>
        <div style={{ fontStyle: 'italic', fontSize: 34, color: EMBER, opacity: fade(f, 200, 300) }}>{typed('I almost believe you.', f, 205, 2.4)}</div>
        <div style={{ fontStyle: 'italic', fontSize: 26, color: DIM, marginTop: 14, opacity: fade(f, 250, 300) }}>Then answer, well enough to pass as human.</div>
      </div>
    </Frame>
  );
};

const SunsetScene: React.FC = () => {
  const f = useCurrentFrame();
  const sunY = interpolate(f, [0, 300], [8, 78], { extrapolateRight: 'clamp' });
  const dark = interpolate(f, [0, 300], [0, 0.7], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ fontFamily: serif }}>
      <AbsoluteFill style={{ background: 'linear-gradient(#22304f, #7a3a22)' }} />
      <div style={{ position: 'absolute', right: '14%', top: '12%', width: 360, height: 460, overflow: 'hidden', boxShadow: '0 0 80px rgba(0,0,0,0.7)' }}>
        <div style={{ position: 'absolute', left: '50%', top: `${sunY}%`, width: 170, height: 170, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(circle, #fff2cf, #f0a338 40%, transparent 70%)', boxShadow: '0 0 90px 24px #e07b38' }} />
        {[28, 50, 72].map((x) => (
          <div key={x} style={{ position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 4, background: '#05040a' }} />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 4, background: '#05040a' }} />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(3,2,7,${dark}) 100%)` }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 96 }}>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 6, textTransform: 'uppercase', color: BONE, opacity: fade(f, 30, 300) }}>spend your light: stay alive, or be believed</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Dedication: React.FC = () => {
  const f = useCurrentFrame();
  const dawn = interpolate(f, [20, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Frame>
      <div style={{ height: 2, width: '100%', background: 'linear-gradient(90deg,#f0a338,transparent)', boxShadow: '0 0 26px 2px rgba(240,163,56,0.45)', transform: `scaleX(${dawn})`, transformOrigin: 'left', marginBottom: 40 }} />
      <div style={{ fontSize: 52, color: BONE, opacity: fade(f, 30, 240) }}>You passed the night.</div>
      <div style={{ fontFamily: MONO, fontSize: 22, color: EMBER, marginTop: 28, opacity: fade(f, 110, 240) }}>For Alan Turing · 1912&ndash;1954</div>
    </Frame>
  );
};

const TitleCard: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Frame>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 50% at 50% 30%, rgba(244,178,88,0.16), transparent 70%)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, opacity: fade(f, 6, 300) }}>
        <div style={{ fontSize: 110, fontWeight: 600, letterSpacing: 24, color: BONE }}>PASS</div>
        <div style={{ fontStyle: 'italic', fontSize: 30, color: DIM }}>a solstice interrogation</div>
        <div style={{ fontFamily: MONO, fontSize: 20, color: EMBER, marginTop: 18 }}>pass-game-elizabeth-emersons-projects.vercel.app</div>
      </div>
    </Frame>
  );
};

// A crafted 1200x630 noir cover for the DEV post + social previews (no Gemini needed).
export const OgCard: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: INK, fontFamily: serif }}>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 60% at 30% -5%, rgba(244,178,88,0.18), transparent 60%)' }} />
    <div style={{ position: 'absolute', right: 96, top: 80, width: 300, height: 400, overflow: 'hidden', background: 'linear-gradient(#22304f, #7a3a22)', boxShadow: '0 0 90px rgba(0,0,0,0.75)' }}>
      <div style={{ position: 'absolute', left: '50%', top: '40%', width: 150, height: 150, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(circle, #fff2cf, #f0a338 40%, transparent 70%)', boxShadow: '0 0 90px 24px #e07b38' }} />
      {[28, 50, 72].map((x) => (
        <div key={x} style={{ position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 4, background: '#05040a' }} />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 4, background: '#05040a' }} />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 4px #0a0810' }} />
    </div>
    <div style={{ position: 'absolute', left: 96, top: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 104, fontWeight: 600, letterSpacing: 22, color: BONE }}>PASS</div>
      <div style={{ fontStyle: 'italic', fontSize: 30, color: DIM }}>a solstice interrogation · an Alan Turing tribute</div>
      <div style={{ fontFamily: MONO, fontSize: 20, color: EMBER, marginTop: 8 }}>you are the machine. answer well.</div>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 38% 45%, transparent 38%, rgba(3,2,7,0.62) 100%)' }} />
  </AbsoluteFill>
);

export const Trailer: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: INK }}>
    <Series>
      <Series.Sequence durationInFrames={180}><ColdOpen /></Series.Sequence>
      <Series.Sequence durationInFrames={180}><CipherScene /></Series.Sequence>
      <Series.Sequence durationInFrames={300}><ExchangeScene /></Series.Sequence>
      <Series.Sequence durationInFrames={300}><SunsetScene /></Series.Sequence>
      <Series.Sequence durationInFrames={240}><Dedication /></Series.Sequence>
      <Series.Sequence durationInFrames={300}><TitleCard /></Series.Sequence>
    </Series>
  </AbsoluteFill>
);
