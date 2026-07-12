/**
 * Generates a bodymovin Lottie confetti burst (the morning-reveal win moment,
 * spec §11d moment 2). Darkroom palette only — safelight / paper / heart, never
 * crown gold (crown gold is PotD-only). Run: node scripts/gen-confetti.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const FR = 30;
const OP = 72; // ~2.4s
const W = 300;
const H = 300;
const N = 30;

const COLORS = [
  [1, 0.353, 0.212], // safelight #FF5A36
  [0.949, 0.929, 0.894], // paper #F2EDE4
  [0.902, 0.271, 0.235], // heart #E6453C
];

// Deterministic PRNG so regenerating gives a stable asset.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (a, b) => a + (b - a) * rand();

const layers = [];
for (let i = 0; i < N; i++) {
  const startT = Math.floor(between(0, 10));
  const x0 = W / 2 + between(-30, 30);
  const y0 = between(30, 70);
  const x1 = between(20, W - 20);
  const y1 = between(H - 40, H + 20);
  const r0 = between(0, 360);
  const r1 = r0 + between(-540, 540);
  const w = between(6, 12);
  const h = between(10, 18);
  const c = COLORS[i % COLORS.length];

  layers.push({
    ddd: 0,
    ind: i + 1,
    ty: 4,
    nm: `c${i}`,
    sr: 1,
    ks: {
      o: { a: 1, k: [{ t: startT, s: [100] }, { t: OP - 14, s: [100] }, { t: OP, s: [0] }] },
      r: { a: 1, k: [{ t: startT, s: [r0] }, { t: OP, s: [r1] }] },
      p: {
        a: 1,
        k: [
          { t: startT, s: [x0, y0], to: [0, 0], ti: [0, 0] },
          { t: OP, s: [x1, y1] },
        ],
      },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr',
        it: [
          { ty: 'rc', d: 1, s: { a: 0, k: [w, h] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 } },
          { ty: 'fl', c: { a: 0, k: [...c, 1] }, o: { a: 0, k: 100 } },
          {
            ty: 'tr',
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        ],
        nm: `g${i}`,
      },
    ],
    ip: 0,
    op: OP,
    st: 0,
    bm: 0,
  });
}

const anim = { v: '5.7.4', fr: FR, ip: 0, op: OP, w: W, h: H, nm: 'confetti', ddd: 0, assets: [], layers };

mkdirSync('assets/lottie', { recursive: true });
writeFileSync('assets/lottie/confetti.json', JSON.stringify(anim));
console.log(`wrote assets/lottie/confetti.json (${N} pieces, ${OP / FR}s)`);
