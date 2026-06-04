// Build-time art generation with Gemini (Nano Banana, gemini-2.5-flash-image).
// Run: node scripts/gen-art.mjs   (reads GEMINI_API_KEY from env or .env.local)
// Writes PNGs to public/. Commit them; do NOT generate at runtime.
import { GoogleGenAI } from '@google/genai';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

function key() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('no GEMINI_API_KEY');
}

const ai = new GoogleGenAI({ apiKey: key() });
const NOIR = '1952 film noir, Kodak orthochromatic grain, chiaroscuro single desk-lamp light, deep blacks, blown amber highlights, high contrast, cinematic, no text, no lettering';

const ASSETS = [
  {
    name: 'og',
    prompt: `Cover art, ${NOIR}. A dark 1952 interrogation room: a single desk lamp casts a hard warm cone of light onto a table; a tall barred window in the background glows with a low amber setting sun; a shadowed silhouette of a man in a suit seated across the table, seen from behind. Wide cinematic 16:9 composition, moody, oppressive, beautiful.`,
  },
  {
    name: 'texture-paper',
    prompt: `Seamless tileable texture, ${NOIR}. Aged photographic paper and 35mm film base, dark charcoal with a faint warm amber tint, fine silver-halide grain, a few faint scratches, very dark, no large patterns, no subject.`,
  },
  {
    name: 'silhouette',
    prompt: `${NOIR}. A pure black backlit silhouette of a man in a 1950s suit and fedora, seen from behind, rim-lit by a frosted barred window behind him, isolated on a near-black background. Anonymous, faceless, atmospheric.`,
  },
];

for (const a of ASSETS) {
  process.stdout.write(`generating ${a.name}... `);
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: a.prompt,
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (!img) {
      console.log('NO IMAGE in response', JSON.stringify(parts).slice(0, 200));
      continue;
    }
    writeFileSync(`public/${a.name}.png`, Buffer.from(img.inlineData.data, 'base64'));
    console.log('ok');
  } catch (e) {
    console.log('FAILED', String(e).slice(0, 200));
  }
}
