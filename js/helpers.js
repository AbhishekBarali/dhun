// Shared drawing helpers for templates.
// Everything is resolution independent: size things from f.w, f.h and f.s
// (the shorter side of the video) instead of fixed pixel numbers, because the
// same template draws a small preview, a 1080p video, wide, tall and square.

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-dt * speed));

export const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
};

// Small seeded random generator (mulberry32). Use it in setup() so a template
// looks the same in the preview and in the final video.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap smooth 1-D noise, -1..1. Good for wobble, wind, flicker.
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const fr = x - i;
  const h = (n) => {
    const s = Math.sin((n + seed * 101.7) * 127.1) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = fr * fr * (3 - 2 * fr);
  return lerp(h(i), h(i + 1), u);
}

// ---------- colour ----------
export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
export function rgba(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a)})`;
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
// amt > 0 lightens towards white, amt < 0 darkens towards black.
export function shade(hex, amt) {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt);
}
export const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// ---------- shapes ----------
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Adds a smooth curve through points [[x,y],...] to the current path.
// Call ctx.beginPath() yourself first (or moveTo), so you can close and fill.
export function smoothLine(ctx, pts, moveFirst = true) {
  if (pts.length < 2) return;
  if (moveFirst) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

// Smooth closed loop through points (for blobs and rings).
export function smoothLoop(ctx, pts) {
  const n = pts.length;
  if (n < 3) return;
  const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

// Run fn with a soft glow. shadowBlur is costly at 1080p: use it on a few
// strokes, not on hundreds of particles.
export function withGlow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

// ---------- images ----------
// Draw img so it covers the rect (like CSS object-fit: cover).
// zoom >= 1 zooms in; fx, fy (0..1) pick which part stays in view.
export function drawCover(ctx, img, x, y, w, h, zoom = 1, fx = 0.5, fy = 0.5) {
  const iw = img.width || img.videoWidth, ih = img.height || img.videoHeight;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale, dh = ih * scale;
  const dx = x + (w - dw) * fx, dy = y + (h - dh) * fy;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// Draw img fully inside the rect (object-fit: contain). Returns the drawn rect.
export function drawContain(ctx, img, x, y, w, h) {
  const iw = img.width || img.videoWidth, ih = img.height || img.videoHeight;
  if (!iw || !ih) return null;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

// Slow "Ken Burns" drift so a still photo never looks frozen.
// Respects the user's "slow zoom" switch (f.motion).
export function slowZoom(f, amount = 0.08, period = 36) {
  if (!f.motion) return { zoom: 1 + amount * 0.25, fx: 0.5, fy: 0.5 };
  const p = (Math.sin((f.t / period) * TAU - Math.PI / 2) + 1) / 2; // 0..1..0
  return {
    zoom: 1 + amount * (0.15 + 0.85 * p),
    fx: 0.5 + 0.12 * Math.sin(f.t / (period * 1.3)),
    fy: 0.5 + 0.08 * Math.cos(f.t / (period * 1.7)),
  };
}

// Full-frame photo background.
// opts.kind: 'sharp' | 'blur' | 'gray'   opts.dim: 0..1 darkening
// opts.punch: extra zoom on each beat (e.g. 0.03)   opts.zoom: Ken Burns amount
export function photoBackground(ctx, f, opts = {}) {
  const { kind = 'sharp', dim = 0, punch = 0, zoom = 0.08, shake = 0 } = opts;
  const img = f.photo[kind] || f.photo.sharp;
  const z = slowZoom(f, zoom);
  const extra = 1 + punch * f.a.beat;
  ctx.save();
  if (shake) {
    const k = shake * f.a.kick * f.s;
    ctx.translate(noise1(f.t * 30, 1) * k, noise1(f.t * 30, 2) * k);
  }
  drawCover(ctx, img, 0, 0, f.w, f.h, z.zoom * extra * (shake ? 1.03 : 1), z.fx, z.fy);
  ctx.restore();
  if (dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${clamp(dim)})`;
    ctx.fillRect(0, 0, f.w, f.h);
  }
}

// Photo clipped to a circle. Returns nothing; draws in place.
export function circlePhoto(ctx, f, cx, cy, r, zoom = 1.05) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  drawCover(ctx, f.photo.sharp, cx - r, cy - r, r * 2, r * 2, zoom);
  ctx.restore();
}

// Photo clipped to a rounded square ("album cover").
export function coverPhoto(ctx, f, x, y, size, radius, zoom = 1) {
  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  drawCover(ctx, f.photo.sharp, x, y, size, size, zoom);
  ctx.restore();
}

export function vignette(ctx, f, strength = 0.5) {
  const g = ctx.createRadialGradient(f.w / 2, f.h / 2, f.s * 0.3, f.w / 2, f.h / 2, Math.hypot(f.w, f.h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.w, f.h);
}

// Vertical darkening at the bottom (or top) so waves and words stay readable.
export function fadeEdge(ctx, f, edge = 'bottom', size = 0.45, alpha = 0.7, color = '#000000') {
  const h = f.h * size;
  const y0 = edge === 'bottom' ? f.h - h : 0;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  const solid = rgba(color, alpha), clear = rgba(color, 0);
  g.addColorStop(0, edge === 'bottom' ? clear : solid);
  g.addColorStop(1, edge === 'bottom' ? solid : clear);
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, f.w, h);
}

// Film grain from a cached noise tile. amount 0..1.
let grainTile = null;
export function grain(ctx, f, amount = 0.08) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 128;
    const g = grainTile.getContext('2d');
    const d = g.createImageData(128, 128);
    const r = rng(7);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = r() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  const ox = Math.floor(Math.random() * 128), oy = Math.floor(Math.random() * 128);
  const scale = Math.max(1, f.s / 540);
  ctx.translate(-ox * scale, -oy * scale);
  ctx.scale(scale, scale);
  if (!ctx._dhunGrain) ctx._dhunGrain = ctx.createPattern(grainTile, 'repeat');
  ctx.fillStyle = ctx._dhunGrain;
  ctx.fillRect(0, 0, f.w / scale + 128, f.h / scale + 128);
  ctx.restore();
}

// ---------- audio helpers ----------
// Average of f.a.bands between two positions (0..1 along the spectrum).
export function band(f, lo, hi) {
  const b = f.a.bands, n = b.length;
  const i0 = Math.floor(lo * n), i1 = Math.max(i0 + 1, Math.floor(hi * n));
  let s = 0;
  for (let i = i0; i < i1; i++) s += b[i];
  return s / (i1 - i0);
}

// Resample an array to n values (linear). Handy to get 24 bars from 64 bands.
export function resample(arr, n, out = new Float32Array(n)) {
  const m = arr.length;
  for (let i = 0; i < n; i++) {
    const p = (i / Math.max(1, n - 1)) * (m - 1);
    const j = Math.floor(p), fr = p - j;
    out[i] = lerp(arr[j], arr[Math.min(m - 1, j + 1)], fr);
  }
  return out;
}

// Mirror a spectrum so bass sits in the middle: [hi..lo, lo..hi].
export function mirrored(arr, n) {
  const half = resample(arr, Math.ceil(n / 2));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
    out[i] = half[Math.min(half.length - 1, Math.round(k * (half.length - 1)))];
  }
  return out;
}

export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
