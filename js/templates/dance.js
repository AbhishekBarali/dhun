// Dance & party looks: neon, club lights, lasers. Clean shapes driven by the beat.
import {
  TAU, clamp, lerp, rng, noise1, rgba, mix, shade, hexToRgb, rgbToHex, resample,
  mirrored, smoothLine, smoothLoop, photoBackground, drawCover, circlePhoto,
  fadeEdge, vignette, roundRect,
} from '../helpers.js';

// ---------- colour ----------
function hueOf(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// Five neon colours built around the user's accent, cached in the state.
function neon(f, st) {
  const key = f.color.accent + f.color.accent2;
  if (st.neonKey !== key) {
    const h = hueOf(f.color.accent);
    st.neonKey = key;
    st.neon = [
      f.color.accent, f.color.accent2,
      hslHex(h + 180, 1, 0.6), hslHex(h + 90, 1, 0.62), hslHex(h + 270, 1, 0.64),
    ];
  }
  return st.neon;
}

const frac = (x) => x - Math.floor(x);

// Static darkening (vignette, edge fades) painted once at quarter size and
// stretched over the frame: much cheaper than a full-size gradient each frame.
function shadeLayer(ctx, f, st, paint) {
  const key = f.w + 'x' + f.h;
  if (st.shadeKey !== key) {
    st.shadeKey = key;
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(f.w / 4));
    c.height = Math.max(2, Math.round(f.h / 4));
    const small = { ...f, w: c.width, h: c.height, s: Math.min(c.width, c.height) };
    paint(c.getContext('2d'), small);
    st.shade = c;
  }
  ctx.drawImage(st.shade, 0, 0, f.w, f.h);
}

// ---------- 1. Neon Tunnel ----------
const neonTunnel = {
  id: 'neon-tunnel',
  name: 'Neon Tunnel',
  ne: 'नियोन सुरुङ',
  cat: 'dance',
  text: (f) => ({
    title: { y: f.portrait ? 0.12 : 0.12, font: 'teko', style: 'glow', size: 0.085, upper: true },
    sub: { y: f.portrait ? 0.165 : 0.2, font: 'monoton', style: 'glow', color: 'accent', size: 0.05, opacity: 1 },
  }),
  setup: () => ({ rings: [], travel: 0, n: 0 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const cols = neon(f, st);
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, w, h);
    photoBackground(ctx, f, { kind: 'blur', dim: 0.78, zoom: 0.1 });

    const speed = 0.32 + a.energy * 0.45 + a.kick * 0.3;
    st.travel += f.dt * speed * 0.55;
    if (a.beatHit) {
      st.rings.push({ p: 0, c: st.n % cols.length, spin: st.n % 2 ? 1 : -1 });
      st.n++;
    }
    for (const r of st.rings) r.p += f.dt * speed * 0.7;
    while (st.rings.length && st.rings[0].p >= 1) st.rings.shift();

    const cx = w / 2 + noise1(f.t * 0.35, 1) * s * 0.025;
    const cy = h / 2 + noise1(f.t * 0.35, 2) * s * 0.025;
    // depth 0..1 -> size as a fraction of the frame (perspective)
    const size = (p) => 0.2 / (1 - p * 0.94);
    const frame = (k, rot) => {
      const hw = k * w * 0.5, hh = k * h * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      roundRect(ctx, -hw, -hh, hw * 2, hh * 2, Math.min(hw, hh) * 0.32);
      ctx.restore();
    };

    // faint photo window at the far end
    const ps = s * (f.portrait ? 0.36 : 0.3) * (1 + a.beat * 0.04);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ps * 1.6);
    glow.addColorStop(0, rgba(cols[0], 0.35 + a.beat * 0.25));
    glow.addColorStop(1, rgba(cols[0], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.6;
    roundRect(ctx, cx - ps / 2, cy - ps / 2, ps, ps, ps * 0.18);
    ctx.clip();
    drawCover(ctx, f.photo.sharp, cx - ps / 2, cy - ps / 2, ps, ps, 1.05 + a.beat * 0.03);
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    // tunnel rails from the far end to the corners
    ctx.strokeStyle = rgba(cols[1], 0.18);
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const k0 = size(0), k1 = 3;
      ctx.moveTo(cx + sx * k0 * w * 0.42, cy + sy * k0 * h * 0.42);
      ctx.lineTo(cx + sx * k1 * w * 0.42, cy + sy * k1 * h * 0.42);
    }
    ctx.stroke();

    // a steady stream of thin rings so the tunnel always rushes
    const N = 9;
    for (let i = 0; i < N; i++) {
      const p = frac(st.travel + i / N);
      const k = size(p);
      const al = clamp(p * 5) * clamp((1.5 - k) / 0.6) * 0.32;
      if (al <= 0.01) continue;
      frame(k, 0);
      ctx.strokeStyle = rgba(mix(cols[1], '#ffffff', 0.3), al);
      ctx.lineWidth = Math.max(1, s * 0.0016 * k * 2);
      ctx.stroke();
    }

    // bright beat rings: wide soft pass, then the core
    for (const r of st.rings) {
      const k = size(r.p);
      const al = clamp(r.p * 8) * clamp((2.6 - k) / 1.2);
      if (al <= 0.01) continue;
      const c = cols[r.c];
      const lw = Math.max(1.5, s * 0.0045 * Math.min(k, 2.2) * 1.6);
      frame(k, r.spin * r.p * 0.35);
      ctx.strokeStyle = rgba(c, 0.22 * al);
      ctx.lineWidth = lw * 5;
      ctx.stroke();
      ctx.strokeStyle = rgba(c, 0.95 * al);
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.7 * al);
      ctx.lineWidth = lw * 0.35;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    shadeLayer(ctx, f, st, (g, sf) => {
      fadeEdge(g, sf, 'top', 0.3, 0.45);
      vignette(g, sf, 0.5);
    });
  },
};

// ---------- 2. Lasers ----------
const lasers = {
  id: 'lasers',
  name: 'Lasers',
  ne: 'लेजर',
  cat: 'dance',
  text: (f) => ({
    title: { y: f.portrait ? 0.4 : 0.42, font: 'khand', style: 'glow', size: f.portrait ? 0.1 : 0.09, upper: true },
    sub: { y: f.portrait ? 0.45 : 0.52, font: 'monoton', style: 'glow', color: 'accent', size: 0.05, opacity: 1 },
  }),
  setup: () => ({ ci: 0, ang: [0, 0], spread: 0.1 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const cols = neon(f, st);
    photoBackground(ctx, f, { dim: 0.66, zoom: 0.08, punch: 0.01 });
    if (a.beatHit) st.ci++;
    // every 8 beats the beams change pattern: fan, cross, straight up
    const mode = Math.floor(a.beats / 8) % 3;
    const target = [0.55, 0.85, 0.3][mode];
    st.ang[0] = lerp(st.ang[0], target, 1 - Math.exp(-f.dt * 2));
    const tSpread = [0.12, 0.06, 0.2][mode] + a.energy * 0.06 + a.beat * 0.05;
    st.spread = lerp(st.spread, tSpread, 1 - Math.exp(-f.dt * 6));

    ctx.globalCompositeOperation = 'lighter';

    const L = Math.hypot(w, h) * 1.15;
    const nb = f.portrait ? 5 : 6;
    const srcs = [[w * 0.03, h * 1.01, 1], [w * 0.97, h * 1.01, -1]];
    for (let side = 0; side < 2; side++) {
      const [sx, sy, dir] = srcs[side];
      const c = cols[(st.ci + side * 2) % cols.length];
      const sweep = Math.sin(f.t * 0.9 + side * 1.9) * (0.18 + a.energy * 0.2);
      const centre = -Math.PI / 2 + dir * (st.ang[0] + sweep) * (f.portrait ? 0.55 : 1);
      // light scattered by the haze around the whole fan
      // (two overlapping fans so the edges fade instead of cutting off)
      const hz = ctx.createRadialGradient(sx, sy, 0, sx, sy, L * 0.5);
      hz.addColorStop(0, rgba(c, 0.13 + a.energy * 0.05));
      hz.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = hz;
      for (const k of [nb / 2 - 0.5, nb / 2 + 1.2]) {
        const fan = k * st.spread;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, L * 0.5, centre - fan, centre + fan);
        ctx.closePath();
        ctx.fill();
      }
      for (let j = 0; j < nb; j++) {
        const ang = centre + (j - (nb - 1) / 2) * st.spread;
        const ex = sx + Math.cos(ang) * L, ey = sy + Math.sin(ang) * L;
        const g = ctx.createLinearGradient(sx, sy, ex, ey);
        g.addColorStop(0, rgba(c, 0.7));
        g.addColorStop(0.55, rgba(c, 0.2));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        const nx = -Math.sin(ang) * L * 0.011, ny = Math.cos(ang) * L * 0.011;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex + nx, ey + ny);
        ctx.lineTo(ex - nx, ey - ny);
        ctx.closePath();
        ctx.fill();
        // thin bright core
        const g2 = ctx.createLinearGradient(sx, sy, ex, ey);
        g2.addColorStop(0, rgba(shade(c, 0.6), 0.95));
        g2.addColorStop(0.7, rgba(c, 0.15));
        g2.addColorStop(1, rgba(c, 0));
        ctx.strokeStyle = g2;
        ctx.lineWidth = Math.max(1, s * 0.0028);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (ex - sx) * 0.75, sy + (ey - sy) * 0.75);
        ctx.stroke();
      }
      // glowing source in the corner
      const fr = s * (0.12 + a.kick * 0.06);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, fr);
      sg.addColorStop(0, rgba('#ffffff', 0.85));
      sg.addColorStop(0.3, rgba(c, 0.6));
      sg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(sx - fr, sy - fr, fr * 2, fr * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    shadeLayer(ctx, f, st, (g, sf) => {
      // calm patch where the words sit
      const tx = sf.w / 2, ty = sf.h * (sf.portrait ? 0.42 : 0.46), tr = sf.s * 0.42;
      const dk = g.createRadialGradient(tx, ty, 0, tx, ty, tr);
      dk.addColorStop(0, 'rgba(0,0,0,0.38)');
      dk.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = dk;
      g.fillRect(0, 0, sf.w, sf.h);
      vignette(g, sf, 0.55);
    });
  },
};

// ---------- 3. Retro Sun ----------
const synthwave = {
  id: 'synthwave',
  name: 'Retro Sun',
  ne: 'रेट्रो सूर्य',
  cat: 'dance',
  text: (f) => ({
    title: { y: f.portrait ? 0.13 : 0.12, font: 'baloo', style: 'glow', size: 0.08, color: '#ffffff' },
    sub: { y: f.portrait ? 0.18 : 0.205, font: 'monoton', style: 'glow', color: 'accent2', size: 0.05, opacity: 1 },
  }),
  setup: () => ({ scroll: 0, sun: 0, mtn: new Float32Array(25), far: new Float32Array(25), spec: new Float32Array(25) }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const hot = mix('#ff2f86', f.color.accent, 0.3);
    const gold = mix('#ffe873', f.color.accent2, 0.2);
    const grid = mix('#ff3df0', f.color.accent, 0.35);
    const hz = h * (f.portrait ? 0.6 : 0.63);

    // sky: the photo under a dusk tint
    photoBackground(ctx, f, { zoom: 0.08 });
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, 'rgba(10,2,30,0.72)');
    sky.addColorStop(0.6, rgba(mix('#3a0b5e', hot, 0.25), 0.48));
    sky.addColorStop(1, rgba(hot, 0.5));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hz);

    // sun
    const R = s * (f.portrait ? 0.3 : 0.25) * (1 + a.bass * 0.03 + a.kick * 0.02);
    const cy = hz - R * 0.5;
    const halo = ctx.createRadialGradient(w / 2, cy, R * 0.6, w / 2, cy, R * 2.2);
    halo.addColorStop(0, rgba(hot, 0.5 + a.beat * 0.25));
    halo.addColorStop(1, rgba(hot, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, hz);
    st.sun = (st.sun + f.dt * (0.25 + a.energy * 0.4)) % 1;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, cy, R, 0, TAU);
    ctx.clip();
    const sg = ctx.createLinearGradient(0, cy - R, 0, cy + R * 0.7);
    sg.addColorStop(0, gold);
    sg.addColorStop(1, hot);
    ctx.fillStyle = sg;
    const y0 = cy - R * 0.3;
    ctx.fillRect(w / 2 - R, cy - R, R * 2, y0 - (cy - R));
    const P = R * 0.13;
    for (let y = y0 - P + st.sun * P; y < hz; y += P) {
      const k = clamp((y - y0) / (hz - y0));
      const gap = P * lerp(0.1, 0.62, k);
      const top = Math.max(y, y0 - 1);
      if (y + P - gap > top) ctx.fillRect(w / 2 - R, top, R * 2, y + P - gap - top);
    }
    ctx.restore();

    // spectrum mountains: bass on the edges so the sun stays clear
    const n = st.mtn.length;
    const spec = resample(a.bands, n, st.spec);
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      const v = spec[Math.round((1 - d) * (n - 1))];
      const peak = i % 2 ? 1 : 0.55;
      const tv = (0.15 + v * 0.85) * Math.pow(d, 0.8) * peak;
      st.mtn[i] = lerp(st.mtn[i], tv, 0.35);
      st.far[i] = lerp(st.far[i], tv * 1.25 + 0.04, 0.05);
    }
    const ridge = (arr, amp, fill, line, shift) => {
      ctx.beginPath();
      ctx.moveTo(0, hz + 1);
      for (let i = 0; i < n; i++) ctx.lineTo((i / (n - 1)) * w + shift, hz - arr[i] * amp);
      ctx.lineTo(w, hz + 1);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = Math.max(1, s * 0.0028);
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    ridge(st.far, s * 0.2, '#1e0838', rgba(f.color.accent2, 0.35), -w * 0.02);
    ridge(st.mtn, s * 0.17, '#0d0322', rgba(shade(f.color.accent2, 0.2), 0.95), 0);

    // floor
    const fl = ctx.createLinearGradient(0, hz, 0, h);
    fl.addColorStop(0, '#16052c');
    fl.addColorStop(1, '#05010d');
    ctx.fillStyle = fl;
    ctx.fillRect(0, hz, w, h - hz);

    // grid scrolling toward the viewer, faster when the song is loud
    st.scroll += f.dt * (0.7 + a.energy * 2.6 + a.kick * 1.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hz, w, h - hz);
    ctx.clip();
    ctx.beginPath();
    const u = s * 0.15;
    const nv = Math.ceil((w / 2 / u) * 3);
    for (let i = -nv; i <= nv; i++) {
      ctx.moveTo(w / 2 + i * u * 0.05, hz);
      ctx.lineTo(w / 2 + i * u * 1.6, h);
    }
    const ph = frac(st.scroll);
    for (let k = 0; k < 16; k++) {
      const depth = k + 1 - ph;
      const y = hz + (h - hz) * (0.7 / depth);
      if (y > h + 2) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    const gg = ctx.createLinearGradient(0, hz, 0, h);
    gg.addColorStop(0, rgba(grid, 0.05));
    gg.addColorStop(0.25, rgba(grid, 0.5 + a.beat * 0.3));
    gg.addColorStop(1, rgba(grid, 0.95));
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = gg;
    ctx.lineWidth = Math.max(2, s * 0.009);
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1, s * 0.0028);
    ctx.stroke();
    ctx.restore();

    // horizon line
    ctx.globalCompositeOperation = 'lighter';
    const hl = ctx.createLinearGradient(0, 0, w, 0);
    hl.addColorStop(0, rgba(grid, 0));
    hl.addColorStop(0.5, rgba(shade(grid, 0.5), 0.9));
    hl.addColorStop(1, rgba(grid, 0));
    ctx.fillStyle = hl;
    ctx.fillRect(0, hz - s * 0.003, w, s * 0.006);
    ctx.globalCompositeOperation = 'source-over';
    fadeEdge(ctx, f, 'top', 0.3, 0.35);
  },
};

// Fast rise, slower fall, so bars and waves jump with a hit and settle gently.
const follow = (cur, target, up = 0.6, down = 0.16) => lerp(cur, target, target > cur ? up : down);

// Adds a rounded bar to the current path (no beginPath), so many bars can be
// filled with one call.
function addPill(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A small soft cloud texture (white, alpha = density), made once.
let hazeCanvas = null;
function hazeTile() {
  if (hazeCanvas) return hazeCanvas;
  const W = 160, H = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const d = g.createImageData(W, H);
  const R = rng(23);
  const waves = [];
  for (let k = 0; k < 7; k++) {
    const an = R() * TAU, fr = 0.025 + R() * 0.06;
    waves.push([Math.cos(an) * fr, Math.sin(an) * fr, R() * TAU]);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (const wv of waves) v += Math.sin(x * wv[0] + y * wv[1] + wv[2]);
      v = clamp(0.5 + v / 5);
      const i = (y * W + x) * 4;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
      d.data[i + 3] = Math.round((0.28 + 0.72 * v * v) * 255);
    }
  }
  g.putImageData(d, 0, 0);
  hazeCanvas = c;
  return c;
}

// ---------- 4. Club Lights ----------
const club = {
  id: 'club',
  name: 'Club Lights',
  ne: 'क्लब बत्ती',
  cat: 'dance',
  text: (f) => ({
    title: { y: f.portrait ? 0.42 : 0.44, font: 'teko', style: 'glow', size: f.portrait ? 0.1 : 0.09, upper: true },
    sub: { y: f.portrait ? 0.47 : 0.535, font: 'monoton', style: 'glow', color: 'accent', size: 0.046, opacity: 1 },
  }),
  setup: () => ({ ang: new Float32Array(8), bars: new Float32Array(64), layer: null }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const cols = neon(f, st);
    const floorY = h * (f.portrait ? 0.86 : 0.84);
    photoBackground(ctx, f, { dim: 0.5, zoom: 0.08, punch: 0.008 });
    shadeLayer(ctx, f, st, (g, sf) => {
      const fy = sf.h * (sf.portrait ? 0.86 : 0.84);
      fadeEdge(g, sf, 'top', 0.35, 0.55);
      // dark floor for the bars
      const fg = g.createLinearGradient(0, fy - sf.s * 0.32, 0, sf.h);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(0.55, 'rgba(2,1,6,0.82)');
      fg.addColorStop(1, 'rgba(2,1,6,0.95)');
      g.fillStyle = fg;
      g.fillRect(0, fy - sf.s * 0.32, sf.w, sf.h);
      // calm patch where the words sit
      const tx = sf.w / 2, ty = sf.h * (sf.portrait ? 0.44 : 0.48), tr = sf.s * 0.45;
      const dk = g.createRadialGradient(tx, ty, 0, tx, ty, tr);
      dk.addColorStop(0, 'rgba(0,0,0,0.35)');
      dk.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = dk;
      g.fillRect(0, 0, sf.w, sf.h);
      vignette(g, sf, 0.55);
    });

    // spotlights, drawn small and stretched up (soft for free), masked by haze
    const q = 4;
    const lw = Math.max(2, Math.round(w / q)), lh = Math.max(2, Math.round(h / q));
    if (!st.layer || st.layer.width !== lw || st.layer.height !== lh) {
      st.layer = document.createElement('canvas');
      st.layer.width = lw; st.layer.height = lh;
    }
    const g = st.layer.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'lighter';

    const nb = f.portrait ? 4 : f.square ? 5 : 6;
    // every 8 beats the heads move to a new pattern: sweep, meet, cross
    const mode = Math.floor(a.beats / 8) % 3;
    const swap = Math.floor(a.beats / 16) % 2;
    const fy = floorY / q, sy = -s * 0.03 / q;
    const half = 0.075 + a.energy * 0.03 + a.beat * 0.012;
    const bright = (f.portrait ? 0.27 : 0.32) + a.energy * 0.14 + a.beat * 0.08;
    const heads = [];
    for (let i = 0; i < nb; i++) {
      const sx = (w * (i + 0.5)) / nb / q;
      const side = i - (nb - 1) / 2;
      let target;
      if (mode === 0) target = Math.sin(f.t * 0.75 + i * 1.1) * 0.38;
      else if (mode === 1) target = Math.atan2(w / 2 / q - sx, fy - sy) + Math.sin(f.t * 1.3 + i) * 0.05;
      else target = (i % 2 ? 0.36 : -0.36) * (f.portrait ? 0.8 : 1) + Math.sin(f.t * 0.9) * 0.12 + side * 0.02;
      st.ang[i] = lerp(st.ang[i], target, 1 - Math.exp(-f.dt * 2.2));
      const ang = st.ang[i];
      const c = cols[(i + swap) % 2];
      const len = (fy - sy) / Math.cos(ang);
      const ex = sx + Math.sin(ang) * len, ey = sy + Math.cos(ang) * len;
      const nx = Math.cos(ang), ny = -Math.sin(ang);
      const gr = g.createLinearGradient(sx, sy, ex, ey);
      gr.addColorStop(0, rgba(shade(c, 0.35), bright));
      gr.addColorStop(0.35, rgba(c, bright * 0.55));
      gr.addColorStop(1, rgba(c, bright * 0.22));
      g.fillStyle = gr;
      // three nested cones give a soft edge and a brighter core
      for (const k of [1, 0.62, 0.3]) {
        const hw = Math.tan(half * k) * len, sw = s * 0.004 / q;
        g.beginPath();
        g.moveTo(sx - nx * sw, sy - ny * sw);
        g.lineTo(sx + nx * sw, sy + ny * sw);
        g.lineTo(ex + nx * hw, ey + ny * hw);
        g.lineTo(ex - nx * hw, ey - ny * hw);
        g.closePath();
        g.fill();
      }
      heads.push([sx * q, ex * q, c, Math.tan(half) * len * q]);
    }
    // haze: the beams only show where the smoke is thick
    g.globalCompositeOperation = 'destination-in';
    const hz = hazeTile();
    const dx = Math.sin(f.t * 0.05) * lw * 0.2 - lw * 0.25, dy = Math.cos(f.t * 0.04) * lh * 0.1 - lh * 0.2;
    g.drawImage(hz, dx, dy, lw * 1.5, lh * 1.4);
    g.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(st.layer, 0, 0, w, h);

    // pools of light where the beams land on the floor
    for (const [, ex, c, spread] of heads) {
      const pr = Math.max(s * 0.06, spread * 0.9);
      ctx.save();
      ctx.translate(ex, floorY);
      ctx.scale(1, 0.16);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
      pg.addColorStop(0, rgba(c, 0.32 + a.beat * 0.12));
      pg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = pg;
      ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
      ctx.restore();
    }
    // the light heads along the top edge
    for (const [hx, , c] of heads) {
      const fr = s * (0.05 + a.kick * 0.015);
      const hg = ctx.createRadialGradient(hx, 0, 0, hx, 0, fr);
      hg.addColorStop(0, rgba('#ffffff', 0.85));
      hg.addColorStop(0.25, rgba(c, 0.55));
      hg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = hg;
      ctx.fillRect(hx - fr, 0, fr * 2, fr);
    }
    ctx.globalCompositeOperation = 'source-over';

    // mirrored bars on the floor, bass in the middle
    const n = f.portrait ? 26 : f.square ? 34 : 50;
    const vals = mirrored(a.bands.subarray(0, 48), n);
    const slot = (w * 0.92) / n, bw = slot * 0.5, x0 = w * 0.04;
    const maxH = s * (f.portrait ? 0.15 : 0.17);
    ctx.beginPath();
    const tops = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const taper = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * (0.04 + x * 0.92)), 0.7);
      st.bars[i] = follow(st.bars[i], clamp(vals[i] * taper * (1 + a.kick * 0.15)), 0.6, 0.14);
      const bh = Math.max(bw, st.bars[i] * maxH);
      tops.push(bh);
      addPill(ctx, x0 + i * slot + (slot - bw) / 2, floorY - bh, bw, bh + bw * 0.5, bw / 2);
    }
    const bg = ctx.createLinearGradient(x0, 0, w - x0, 0);
    bg.addColorStop(0, cols[1]);
    bg.addColorStop(0.5, shade(cols[0], 0.15));
    bg.addColorStop(1, cols[1]);
    ctx.fillStyle = bg;
    ctx.fill();
    // reflection: same bars upside down, fading into the floor
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = tops[i] * 0.55;
      addPill(ctx, x0 + i * slot + (slot - bw) / 2, floorY + s * 0.008, bw, bh, bw / 2);
    }
    const rg = ctx.createLinearGradient(0, floorY, 0, floorY + maxH * 0.55);
    rg.addColorStop(0, rgba(mix(cols[0], cols[1], 0.5), 0.32));
    rg.addColorStop(1, rgba(mix(cols[0], cols[1], 0.5), 0));
    ctx.fillStyle = rg;
    ctx.fill();
    // thin bright floor line
    const fl = ctx.createLinearGradient(0, 0, w, 0);
    fl.addColorStop(0, rgba(cols[1], 0));
    fl.addColorStop(0.5, rgba(shade(cols[0], 0.5), 0.75));
    fl.addColorStop(1, rgba(cols[1], 0));
    ctx.fillStyle = fl;
    ctx.fillRect(0, floorY + s * 0.002, w, Math.max(1, s * 0.002));
  },
};

// ---------- 5. Prism Ring ----------
const prism = {
  id: 'prism',
  name: 'Prism Ring',
  ne: 'प्रिज्म घेरा',
  cat: 'dance',
  text: (f) => (f.portrait
    ? { title: { y: 0.74, font: 'teko', upper: true, style: 'glow', size: 0.09 }, sub: { y: 0.785, font: 'khand', style: 'shadow', size: 0.04, opacity: 0.9 } }
    : f.square
      ? { title: { y: 0.84, font: 'teko', upper: true, style: 'glow', size: 0.075 }, sub: { y: 0.905, font: 'khand', style: 'shadow', size: 0.036, opacity: 0.9 } }
      : { title: { y: 0.85, font: 'teko', upper: true, style: 'glow', size: 0.075 }, sub: { y: 0.925, font: 'khand', style: 'shadow', size: 0.036, opacity: 0.9 } }),
  setup: () => ({ v: new Float32Array(130), half: new Float32Array(66), spin: 0, split: 0 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    photoBackground(ctx, f, { kind: 'blur', dim: 0.42, zoom: 0.12 });
    shadeLayer(ctx, f, st, (g, sf) => vignette(g, sf, 0.65));

    // three colours a third of the colour wheel apart, starting at the accent:
    // where all three overlap they add up to white
    const key = f.color.accent;
    if (st.key !== key) {
      st.key = key;
      const hu = hueOf(f.color.accent);
      st.rgb = [hslHex(hu, 1, 0.56), hslHex(hu + 120, 1, 0.52), hslHex(hu + 240, 1, 0.6)];
    }
    const cx = w / 2, cy = h * (f.portrait ? 0.4 : f.square ? 0.42 : 0.42);
    const r = s * (f.portrait ? 0.22 : f.square ? 0.19 : 0.17) * (1 + a.kick * 0.035);
    const gap = s * 0.025, amp = s * (f.portrait ? 0.15 : 0.13);
    const n = st.v.length - 2;
    const m = n / 2;
    const half = resample(a.bands.subarray(0, 48), m + 1, st.half);
    for (let i = 0; i <= n; i++) {
      const k = i <= m ? i : n - i;
      // bass at the top, a gentle ripple running round so it never sits still
      const flow = 0.85 + 0.15 * Math.sin(k * 0.45 - f.t * 3);
      st.v[i] = follow(st.v[i], clamp(half[k] * flow), 0.55, 0.15);
    }
    // the colours spring apart on each beat, then settle back to white
    st.split = Math.max(a.beat, st.split - f.dt * 2.5);
    st.spin += f.dt * (0.04 + a.energy * 0.06);

    // soft halo
    const halo = ctx.createRadialGradient(cx, cy, r + gap, cx, cy, r + gap + amp * 1.5);
    halo.addColorStop(0, rgba(f.color.accent, 0.16 + a.beat * 0.1));
    halo.addColorStop(1, rgba(f.color.accent, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    const pts = [];
    for (let L = 0; L < 3; L++) {
      const off = (L - 1) * (0.006 + st.split * 0.07) + Math.sin(st.spin) * 0.05;
      const sc = 1 + (L - 1) * st.split * 0.025;
      pts.length = 0;
      for (let i = 0; i < n; i++) {
        const an = -Math.PI / 2 + (i / n) * TAU + off;
        const rr = (r + gap + st.v[i] * amp) * sc;
        pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]);
      }
      const c = st.rgb[L];
      ctx.beginPath();
      smoothLoop(ctx, pts);
      ctx.moveTo(cx + r + gap * 0.5, cy);
      ctx.arc(cx, cy, r + gap * 0.5, 0, TAU, true);
      ctx.fillStyle = rgba(c, 0.045);
      ctx.fill();
      ctx.beginPath();
      smoothLoop(ctx, pts);
      ctx.strokeStyle = rgba(c, 0.18);
      ctx.lineWidth = s * 0.016;
      ctx.stroke();
      ctx.strokeStyle = rgba(c, 0.95);
      ctx.lineWidth = Math.max(1.5, s * 0.0042);
      ctx.stroke();
    }
    // thin outer orbit with a few dots riding on it
    const ro = r + gap + amp * 1.18;
    ctx.beginPath();
    ctx.arc(cx, cy, ro, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = Math.max(1, s * 0.0015);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 3; i++) {
      const an = st.spin * 2 + (i / 3) * TAU;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(an) * ro, cy + Math.sin(an) * ro, s * 0.004, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // the photo with a crisp white rim
    ctx.beginPath();
    ctx.arc(cx, cy, r + s * 0.006, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    circlePhoto(ctx, f, cx, cy, r, 1.05 + a.beat * 0.02);
  },
};

// ---------- 6. Pulse Grid ----------
const pulseGrid = {
  id: 'pulse-grid',
  name: 'Pulse Grid',
  ne: 'धड्कन जाली',
  cat: 'dance',
  text: (f) => ({
    title: { y: 0.5 - 0.03 * f.s / f.h, font: 'khand', style: 'glow', size: f.portrait ? 0.1 : 0.088, upper: true },
    sub: { y: 0.5 + 0.055 * f.s / f.h, font: 'monoton', style: 'glow', color: 'accent', size: 0.042, opacity: 1 },
  }),
  setup(f) {
    const { w, h, s } = f;
    const sp = s * 0.043;
    const nx = Math.floor(w / sp), ny = Math.floor(h / sp);
    const ox = (w - (nx - 1) * sp) / 2, oy = (h - (ny - 1) * sp) / 2;
    const N = nx * ny;
    const F = () => new Float32Array(N);
    const st = { sp, N, x: F(), y: F(), d: F(), ux: F(), uy: F(), k: F(), d1: F(), d2: F(), lv: new Uint8Array(N), dx: F(), ripples: [] };
    const cx = w / 2, cy = h / 2;
    const maxD = Math.hypot(w, h) / 2;
    st.maxD = maxD;
    const rx = Math.min(w * 0.4, s * 0.62), ry = s * 0.17;
    for (let j = 0, i = 0; j < ny; j++) {
      for (let q = 0; q < nx; q++, i++) {
        const x = ox + q * sp, y = oy + j * sp;
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
        st.x[i] = x; st.y[i] = y; st.d[i] = d; st.ux[i] = dx / d; st.uy[i] = dy / d;
        st.d1[i] = Math.hypot(x - (cx - w * 0.32), y - cy * 0.7);
        st.d2[i] = Math.hypot(x - (cx + w * 0.32), y - cy * 1.3);
        // quiet behind the words, and fading out before the edges
        const ty = dy - s * 0.015;
        const tm = Math.exp(-((dx / rx) ** 2 + (ty / ry) ** 2) * 2.2);
        const edge = clamp(Math.min(x, w - x, y, h - y) / (s * 0.12));
        st.k[i] = (1 - 0.88 * tm) * (0.25 + 0.75 * edge);
      }
    }
    return st;
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const cols = neon(f, st);
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.26;
    photoBackground(ctx, f, { kind: 'blur', zoom: 0.1 });
    ctx.globalAlpha = 1;
    // soft colour bloom in the middle that breathes with the beat
    const cx = w / 2, cy = h / 2;
    const bl = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.7);
    bl.addColorStop(0, rgba(cols[0], 0.18 + a.beat * 0.1));
    bl.addColorStop(1, rgba(cols[0], 0));
    ctx.fillStyle = bl;
    ctx.fillRect(0, 0, w, h);

    if (a.beatHit) st.ripples.push({ t: f.t, amp: 0.85 + a.kick * 0.3 });
    while (st.ripples.length && f.t - st.ripples[0].t > 3.2) st.ripples.shift();
    const speed = st.maxD / 1.9, width = s * 0.08;
    const B = a.bands, nb = 44;
    const L = 7;
    const t = f.t;
    for (let i = 0; i < st.N; i++) {
      const d = st.d[i];
      // spectrum as rings: bass near the middle, highs further out
      let v = 0.42 * B[Math.min(nb, Math.floor((d / st.maxD) * nb))];
      // two slow wave sources crossing over each other
      v += 0.3 * (1 + Math.sin(st.d1[i] / (s * 0.07) - t * 2.2)) * (1 + Math.sin(st.d2[i] / (s * 0.07) - t * 1.9)) * 0.25;
      let push = 0;
      for (const r of st.ripples) {
        const age = t - r.t;
        const x = (d - age * speed) / width;
        if (x > 4 || x < -6) continue;
        const e = r.amp * Math.exp(-age * 0.75) * Math.cos(x * 2.2) * Math.exp(-x * x * 0.3);
        v += e;
        push += e;
      }
      v *= st.k[i];
      st.lv[i] = Math.max(0, Math.min(L - 1, Math.floor(v * L)));
      st.dx[i] = push * st.sp * 0.22;
    }
    // one path per brightness step: few style changes, many dots
    const grad = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, st.maxD);
    grad.addColorStop(0, shade(cols[0], 0.2));
    grad.addColorStop(0.55, cols[1]);
    grad.addColorStop(1, shade(cols[1], -0.1));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    for (let l = 0; l < L; l++) {
      const rad = st.sp * (0.09 + 0.25 * (l / (L - 1)));
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < st.N; i++) {
        if (st.lv[i] !== l) continue;
        const x = st.x[i] + st.ux[i] * st.dx[i], y = st.y[i] + st.uy[i] * st.dx[i];
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, TAU);
        any = true;
      }
      if (!any) continue;
      ctx.globalAlpha = 0.3 + 0.7 * (l / (L - 1));
      ctx.fill();
      if (l >= L - 2) {
        // white hot centres on the crest
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < st.N; i++) {
          if (st.lv[i] !== l) continue;
          const x = st.x[i] + st.ux[i] * st.dx[i], y = st.y[i] + st.uy[i] * st.dx[i];
          ctx.moveTo(x + rad * 0.45, y);
          ctx.arc(x, y, rad * 0.45, 0, TAU);
        }
        ctx.fill();
        ctx.fillStyle = grad;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    shadeLayer(ctx, f, st, (g, sf) => vignette(g, sf, 0.6));
  },
};

// ---------- 7. Neon Wave ----------
const WAVES = 5, WPTS = 56;
const neonWave = {
  id: 'neon-wave',
  name: 'Neon Wave',
  ne: 'नियोन लहर',
  cat: 'dance',
  text: (f) => ({
    title: { y: f.portrait ? 0.14 : 0.13, font: 'teko', style: 'glow', size: f.portrait ? 0.1 : 0.088, upper: true },
    sub: { y: f.portrait ? 0.19 : 0.215, font: 'monoton', style: 'glow', color: 'accent', size: 0.046, opacity: 1 },
  }),
  setup: () => ({ v: Array.from({ length: WAVES }, () => new Float32Array(WPTS)), ripple: 0 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const cols = neon(f, st);
    const floorY = h * (f.portrait ? 0.78 : f.square ? 0.75 : 0.77);
    photoBackground(ctx, f, { dim: 0.28, zoom: 0.08, punch: 0.008 });
    shadeLayer(ctx, f, st, (g, sf) => {
      const fy = sf.h * (sf.portrait ? 0.78 : sf.square ? 0.75 : 0.77);
      fadeEdge(g, sf, 'top', 0.32, 0.5);
      // the photo darkens towards the horizon so the neon pops
      const dg = g.createLinearGradient(0, fy - sf.s * 0.45, 0, fy);
      dg.addColorStop(0, 'rgba(3,2,8,0)');
      dg.addColorStop(1, 'rgba(3,2,8,0.85)');
      g.fillStyle = dg;
      g.fillRect(0, fy - sf.s * 0.45, sf.w, sf.s * 0.45);
      // wet floor
      const fl = g.createLinearGradient(0, fy, 0, sf.h);
      fl.addColorStop(0, '#0a0614');
      fl.addColorStop(1, '#020104');
      g.fillStyle = fl;
      g.fillRect(0, fy, sf.w, sf.h - fy);
      vignette(g, sf, 0.45);
    });

    const m = mirrored(a.bands.subarray(0, 50), WPTS);
    const amp = s * (f.portrait ? 0.44 : 0.42) * (1 + a.kick * 0.08);
    const xs = (i) => (i / (WPTS - 1)) * w;
    const layers = [];
    for (let k = 0; k < WAVES; k++) {
      // back waves are taller and lag behind; front waves are quick and low
      const depth = k / (WAVES - 1);
      const rate = lerp(0.12, 0.5, depth);
      const tall = lerp(1, 0.55, depth);
      const arr = st.v[k];
      const pts = [];
      for (let i = 0; i < WPTS; i++) {
        const x = i / (WPTS - 1);
        const taper = Math.pow(Math.sin(Math.PI * x), 0.9);
        const swell = 0.6 + 0.4 * Math.sin(i * (0.22 + k * 0.05) - f.t * (1.1 + k * 0.35) + k * 1.7);
        arr[i] = lerp(arr[i], clamp(m[i] * swell + 0.06) * taper, rate);
        pts.push([xs(i), floorY - arr[i] * amp * tall]);
      }
      layers.push(pts);
    }

    // reflection on the wet floor: squashed, dim, broken by small ripples
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floorY, w, h - floorY);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (let k = 0; k < WAVES; k++) {
      const c = cols[k % 2];
      const rp = layers[k].map(([x, y], i) => [x + Math.sin(i * 1.7 + f.t * 2) * s * 0.003, floorY + (floorY - y) * 0.55]);
      ctx.beginPath();
      smoothLine(ctx, rp);
      ctx.strokeStyle = rgba(c, 0.12 + 0.1 * (k / (WAVES - 1)));
      ctx.lineWidth = s * 0.016;
      ctx.stroke();
      ctx.strokeStyle = rgba(c, 0.5);
      ctx.lineWidth = Math.max(1, s * 0.003);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the reflection fades away from the horizon
    const rf = ctx.createLinearGradient(0, floorY, 0, h);
    rf.addColorStop(0, 'rgba(2,1,4,0)');
    rf.addColorStop(0.85, 'rgba(2,1,4,0.8)');
    rf.addColorStop(1, 'rgba(2,1,4,1)');
    ctx.fillStyle = rf;
    ctx.fillRect(0, floorY, w, h - floorY);
    // thin dark ripple lines, closer together near the horizon
    st.ripple = frac(st.ripple + f.dt * 0.25);
    ctx.fillStyle = 'rgba(2,1,6,0.55)';
    for (let j = 0; j < 14; j++) {
      const p = (j + st.ripple) / 14;
      const y = floorY + (h - floorY) * p * p;
      ctx.fillRect(0, y, w, Math.max(1, s * 0.002 * (0.5 + p * 2)));
    }
    ctx.restore();

    // stacked waves, back to front: dark body, faint colour, neon edge
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let k = 0; k < WAVES; k++) {
      const pts = layers[k];
      const c = cols[k % 2];
      const front = k === WAVES - 1;
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineTo(w, floorY);
      ctx.lineTo(0, floorY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(5,3,12,0.9)';
      ctx.fill();
      const body = ctx.createLinearGradient(0, floorY - amp, 0, floorY);
      body.addColorStop(0, rgba(c, 0.16));
      body.addColorStop(1, rgba(c, 0.02));
      ctx.fillStyle = body;
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      smoothLine(ctx, pts);
      const al = 0.55 + 0.45 * (k / (WAVES - 1));
      ctx.strokeStyle = rgba(c, 0.13 * al + a.beat * 0.04);
      ctx.lineWidth = s * 0.02;
      ctx.stroke();
      ctx.strokeStyle = rgba(c, 0.95 * al);
      ctx.lineWidth = Math.max(1.5, s * (front ? 0.005 : 0.0035));
      ctx.stroke();
      if (front) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(1, s * 0.0016);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // horizon glow line
    ctx.globalCompositeOperation = 'lighter';
    const hl = ctx.createLinearGradient(0, 0, w, 0);
    hl.addColorStop(0, rgba(cols[1], 0));
    hl.addColorStop(0.5, rgba(shade(cols[0], 0.5), 0.85));
    hl.addColorStop(1, rgba(cols[1], 0));
    ctx.fillStyle = hl;
    ctx.fillRect(0, floorY - s * 0.0015, w, Math.max(1, s * 0.003));
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ---------- 8. Kaleidoscope ----------
const kaleido = {
  id: 'kaleido',
  name: 'Kaleidoscope',
  ne: 'क्यालिडोस्कोप',
  cat: 'dance',
  text: (f) => {
    // keep the words inside the centre circle: long titles shrink to fit
    const d = 2 * f.s * (f.portrait ? 0.27 : 0.25) / f.w;
    return {
      title: { y: 0.5 - 0.022 * f.s / f.h, font: 'baloo', style: 'glow', size: 0.068, maxW: d * 0.8 },
      sub: { y: 0.5 + 0.06 * f.s / f.h, font: 'baloo', style: 'glow', color: 'accent', size: 0.036, opacity: 1, maxW: d * 0.66 },
    };
  },
  setup: () => ({ rot: 0 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const cols = neon(f, st);
    const cx = w / 2, cy = h / 2;
    const R = Math.hypot(w, h) / 2 + 2;
    // a square copy of the photo at the size we draw it, made once
    if (st.img !== f.photo.sharp || st.tint !== st.neonKey) {
      st.img = f.photo.sharp;
      st.tint = st.neonKey;
      const src = st.src || document.createElement('canvas');
      src.width = src.height = Math.min(2048, Math.ceil(R * 1.3));
      const g = src.getContext('2d');
      const z = src.width;
      drawCover(g, st.img, 0, 0, z, z);
      // neon colour wash baked into the copy: hot near the centre of the pattern
      g.globalCompositeOperation = 'overlay';
      const wash = g.createLinearGradient(0, 0, z, 0);
      wash.addColorStop(0, rgba(cols[0], 0.4));
      wash.addColorStop(0.6, rgba(cols[4], 0.28));
      wash.addColorStop(1, rgba(cols[2], 0.35));
      g.fillStyle = wash;
      g.fillRect(0, 0, z, z);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, 0, z, z);
      st.src = src;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const n = 10, half = Math.PI / n;
    st.rot += f.dt * (0.1 + a.energy * 0.22 + a.beat * 0.9);
    const zoom = 1 + a.kick * 0.12 + 0.08 * Math.sin(f.t * 0.23);
    // the whole photo sits in each slice; it drifts so the pattern keeps changing
    const D = R * 1.15 * zoom;
    const ox = D / 2 - R * 0.06 + noise1(f.t * 0.15, 3) * R * 0.04;
    const oy = noise1(f.t * 0.11, 4) * R * 0.22;
    const img = st.src;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(i * half * 2 + st.rot);
      if (i % 2) ctx.scale(1, -1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, -half - 0.004, half + 0.004);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, ox - D / 2, oy - D / 2, D, D);
      ctx.restore();
    }

    // colour wash and neon seams
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = i * half * 2 + st.rot + half;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    }
    ctx.strokeStyle = rgba(mix(cols[1], '#ffffff', 0.3), 0.18 + a.beat * 0.35);
    ctx.lineWidth = Math.max(1, s * 0.0025);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // centre circle for the words
    const rc = s * (f.portrait ? 0.27 : 0.25) * (1 + a.beat * 0.03);
    ctx.beginPath();
    ctx.arc(cx, cy, rc, 0, TAU);
    ctx.fillStyle = 'rgba(6,3,14,0.8)';
    ctx.fill();
    // neon rim: soft wide stroke, then a bright thin one
    ctx.beginPath();
    ctx.arc(cx, cy, rc, 0, TAU);
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = rgba(cols[0], 0.18 + a.beat * 0.15);
    ctx.stroke();
    ctx.lineWidth = s * 0.014;
    ctx.strokeStyle = rgba(cols[0], 0.35);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, s * 0.005);
    ctx.strokeStyle = shade(cols[0], 0.45);
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-st.rot * 1.5);
    ctx.setLineDash([s * 0.012, s * 0.018]);
    ctx.beginPath();
    ctx.arc(0, 0, rc * 0.9, 0, TAU);
    ctx.lineWidth = Math.max(1, s * 0.003);
    ctx.strokeStyle = rgba(cols[1], 0.7);
    ctx.stroke();
    ctx.restore();
  },
};

export default [neonWave, club, prism, neonTunnel, pulseGrid, lasers, synthwave, kaleido];
