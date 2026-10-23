// Optional wave along the bottom that can go on top of any look.
import { clamp, lerp, rgba, mirrored, smoothLine, withGlow, fadeEdge, roundRect } from './helpers.js';

export const OVERLAYS = ['off', 'wave', 'bars', 'line'];

function ensure(st, n) {
  if (!st.v || st.v.length !== n) st.v = new Float32Array(n);
  return st.v;
}

function spectrum(f, st, n, speed = 0.5) {
  const v = ensure(st, n);
  const m = mirrored(f.a.bands, n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const taper = Math.pow(Math.sin(Math.PI * x), 0.7);
    v[i] = lerp(v[i], m[i] * taper, speed);
  }
  return v;
}

const draw = {
  wave(ctx, f, st) {
    const { w, h, s } = f;
    fadeEdge(ctx, f, 'bottom', 0.3, 0.55);
    const n = 48;
    const v = spectrum(f, st, n);
    const cy = h - s * 0.1;
    const amp = s * 0.085 * (1 + f.a.kick * 0.15);
    const top = [], bot = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const flow = 0.8 + 0.2 * Math.sin(i * 0.5 - f.t * 2.2);
      top.push([x, cy - v[i] * amp * flow]);
      bot.push([x, cy + v[i] * amp * 0.45 * flow]);
    }
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, rgba(f.color.accent2, 0.85));
    g.addColorStop(0.5, rgba(f.color.accent, 0.95));
    g.addColorStop(1, rgba(f.color.accent2, 0.85));
    ctx.beginPath();
    smoothLine(ctx, top);
    smoothLine(ctx, bot.reverse(), false);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    withGlow(ctx, rgba(f.color.accent, 0.9), s * 0.02, () => {
      ctx.beginPath();
      smoothLine(ctx, top);
      ctx.lineWidth = Math.max(1.5, s * 0.0035);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
    });
  },

  bars(ctx, f, st) {
    const { w, h, s } = f;
    fadeEdge(ctx, f, 'bottom', 0.3, 0.55);
    const n = f.portrait ? 40 : 72;
    const v = spectrum(f, st, n, 0.55);
    const base = h - s * 0.1;
    const gap = w / n;
    const bw = gap * 0.5;
    ctx.fillStyle = f.color.accent;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(bw, v[i] * s * 0.16);
      const x = i * gap + (gap - bw) / 2;
      ctx.globalAlpha = 0.9;
      roundRect(ctx, x, base - bh * 0.7, bw, bh, bw / 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  line(ctx, f, st) {
    const { w, h, s } = f;
    fadeEdge(ctx, f, 'bottom', 0.25, 0.45);
    const n = 64;
    const v = spectrum(f, st, n, 0.45);
    const cy = h - s * 0.09;
    const amp = s * 0.07;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      pts.push([x, cy - v[i] * amp * Math.sin(i * 0.42 - f.t * 2.6)]);
    }
    withGlow(ctx, rgba(f.color.accent, 1), s * 0.025, () => {
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineWidth = Math.max(1.5, s * 0.004);
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba('#ffffff', 0.95);
      ctx.stroke();
    });
    ctx.beginPath();
    smoothLine(ctx, pts.map(([x, y]) => [x, cy + (cy - y) * 0.5]));
    ctx.lineWidth = Math.max(1, s * 0.0025);
    ctx.strokeStyle = rgba(f.color.accent, 0.5);
    ctx.stroke();
  },
};

// Returns a function (ctx, f) that draws the chosen overlay, or null.
export function makeOverlay(kind) {
  if (!draw[kind]) return null;
  const st = {};
  return (ctx, f) => {
    ctx.save();
    draw[kind](ctx, f, st);
    ctx.restore();
  };
}
