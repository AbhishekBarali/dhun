// Dance & party looks: neon, lasers, confetti. Loud colour, driven by the beat.
import {
  TAU, clamp, lerp, rng, noise1, rgba, mix, shade, hexToRgb, rgbToHex, resample,
  photoBackground, drawCover, fadeEdge, vignette, roundRect,
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

// ---------- 4. Confetti ----------
const CONF = 320;
const confetti = {
  id: 'confetti',
  name: 'Confetti',
  ne: 'कन्फेटी',
  cat: 'dance',
  text: (f) => ({
    title: { y: f.portrait ? 0.13 : 0.13, font: 'baloo', style: 'glow', size: 0.085 },
    sub: { y: f.portrait ? 0.18 : 0.215, font: 'monoton', style: 'glow', color: 'accent', size: 0.05, opacity: 1 },
  }),
  setup: () => {
    const F = () => new Float32Array(CONF);
    return {
      r: rng(11), x: F(), y: F(), vx: F(), vy: F(), rot: F(), vr: F(), flip: F(), vf: F(),
      sz: F(), col: new Uint8Array(CONF), kind: new Uint8Array(CONF), on: new Uint8Array(CONF),
      next: 0, burst: 0, drip: 0,
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const cols = neon(f, st);
    if (!st.pal || st.palKey !== st.neonKey) {
      // three brightness steps per colour so flipping pieces catch the light
      st.palKey = st.neonKey;
      st.pal = [...cols, '#ffffff', '#ffd23a'].map((c) => [shade(c, -0.35), c, shade(c, 0.45)]);
    }
    photoBackground(ctx, f, { dim: 0.25, zoom: 0.08, punch: 0.015 });
    fadeEdge(ctx, f, 'top', 0.32, 0.45);

    // disco light spots sweeping over the photo
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const px = w * (0.5 + 0.42 * Math.sin(f.t * (0.31 + i * 0.07) + i * 1.7));
      const py = h * (0.5 + 0.38 * Math.cos(f.t * (0.27 + i * 0.05) + i * 2.3));
      const pr = s * (0.28 + 0.06 * Math.sin(f.t + i));
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, rgba(cols[(i + Math.floor(a.beats / 4)) % cols.length], 0.3 + a.beat * 0.18));
      g.addColorStop(1, rgba(cols[i % cols.length], 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    // mirror-ball sparkles drifting across
    const spin = f.t * 0.25;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 48; i++) {
      const th = (i * 2.399 + spin) % TAU;
      const c = Math.cos(th);
      if (c < 0.15) continue;
      const row = (i * 7) % 12;
      const x = w / 2 + Math.sin(th) * w * 0.62;
      const y = h * (0.08 + row * 0.08);
      const r = s * 0.004 * c * (1 + a.beat * 0.6);
      ctx.globalAlpha = c * (0.35 + a.beat * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const R = st.r;
    const spawn = (x, y, vx, vy) => {
      const i = st.next;
      st.next = (st.next + 1) % CONF;
      st.on[i] = 1;
      st.x[i] = x; st.y[i] = y; st.vx[i] = vx; st.vy[i] = vy;
      st.rot[i] = R() * TAU; st.vr[i] = (R() - 0.5) * 10;
      st.flip[i] = R() * TAU; st.vf[i] = 4 + R() * 8;
      st.sz[i] = 0.6 + R() * 0.7;
      st.col[i] = Math.floor(R() * st.pal.length);
      st.kind[i] = R() < 0.7 ? 0 : R() < 0.6 ? 1 : 2;
    };
    if (a.beatHit) {
      const kind = st.burst++ % 3;
      const count = Math.round(34 + a.energy * 30);
      for (let k = 0; k < count; k++) {
        const sp = s * (1.2 + R() * 1.4);
        if (kind < 2) {
          // corner cannons
          const dir = kind === 0 ? 1 : -1;
          const ang = -Math.PI / 2 + dir * (0.25 + R() * 0.45);
          spawn(kind === 0 ? w * 0.02 : w * 0.98, h * 1.01, Math.cos(ang) * sp, Math.sin(ang) * sp * (f.portrait ? 1.25 : 1));
        } else {
          // pop in the sky
          const ang = R() * TAU;
          spawn(w * (0.3 + R() * 0.4), h * 0.3, Math.cos(ang) * sp * 0.6, Math.sin(ang) * sp * 0.6 - s * 0.3);
        }
      }
    }
    // a light drizzle from the top so it never runs dry
    st.drip += f.dt * (5 + a.energy * 6);
    while (st.drip > 1) {
      st.drip -= 1;
      spawn(R() * w, -s * 0.03, (R() - 0.5) * s * 0.1, s * 0.1);
    }

    const dt = f.dt, drag = Math.exp(-dt * 2.4), g = s * 0.75;
    const base = s * 0.024;
    for (let i = 0; i < CONF; i++) {
      if (!st.on[i]) continue;
      st.vx[i] *= drag;
      st.vy[i] = st.vy[i] * drag + g * dt;
      st.x[i] += (st.vx[i] + Math.sin(f.t * 3 + i) * s * 0.08) * dt;
      st.y[i] += st.vy[i] * dt;
      st.rot[i] += st.vr[i] * dt;
      st.flip[i] += st.vf[i] * dt;
      if (st.y[i] > h + base * 3 || st.x[i] < -w * 0.2 || st.x[i] > w * 1.2) { st.on[i] = 0; continue; }
      const cf = Math.cos(st.flip[i]);
      const lit = st.pal[st.col[i]][cf > 0.5 ? 2 : cf > -0.3 ? 1 : 0];
      const sz = base * st.sz[i];
      ctx.save();
      ctx.translate(st.x[i], st.y[i]);
      ctx.rotate(st.rot[i]);
      ctx.fillStyle = lit;
      if (st.kind[i] === 0) {
        ctx.fillRect(-sz * 0.5, -sz * 0.9 * Math.abs(cf) - 0.5, sz, sz * 1.8 * Math.abs(cf) + 1);
      } else if (st.kind[i] === 1) {
        ctx.scale(1, Math.abs(cf) + 0.08);
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.55, 0, TAU);
        ctx.fill();
      } else {
        ctx.scale(Math.abs(cf) + 0.1, 1);
        ctx.fillRect(-sz * 0.2, -sz * 1.4, sz * 0.4, sz * 2.8);
      }
      ctx.restore();
    }
    shadeLayer(ctx, f, st, (g, sf) => vignette(g, sf, 0.4));
  },
};

// ---------- 5. LED Equalizer ----------
const ledEq = {
  id: 'led-eq',
  name: 'LED Equalizer',
  ne: 'एलइडी इक्वलाइजर',
  cat: 'dance',
  text: (f) => ({
    title: { y: f.portrait ? 0.16 : 0.11, font: 'teko', style: 'glow', size: 0.085, upper: true },
    sub: { y: f.portrait ? 0.205 : 0.185, font: 'monoton', style: 'glow', color: 'accent', size: 0.046, opacity: 1 },
  }),
  setup(f) {
    const cols = f.portrait ? 16 : f.square ? 20 : 28;
    const rows = f.portrait ? 18 : 16;
    const box = f.portrait
      ? { x: f.w * 0.07, y: f.h * 0.4, w: f.w * 0.86, h: f.h * 0.4 }
      : f.square
        ? { x: f.w * 0.08, y: f.h * 0.33, w: f.w * 0.84, h: f.h * 0.5 }
        : { x: f.w * 0.1, y: f.h * 0.3, w: f.w * 0.8, h: f.h * 0.52 };
    const cw = box.w / cols, ch = box.h / rows;
    // unlit grid drawn once
    const off = document.createElement('canvas');
    off.width = Math.ceil(box.w);
    off.height = Math.ceil(box.h);
    const g = off.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < cols; i++) {
      for (let r = 0; r < rows; r++) g.fillRect(i * cw + cw * 0.1, r * ch + ch * 0.12, cw * 0.8, ch * 0.76);
    }
    return { cols, rows, box, cw, ch, off, v: new Float32Array(cols), peak: new Float32Array(cols), hold: new Float32Array(cols), pv: new Float32Array(cols), tmp: new Float32Array(cols) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const { cols, rows, box, cw, ch } = st;
    photoBackground(ctx, f, { dim: 0.5, zoom: 0.08, punch: 0.012 });
    fadeEdge(ctx, f, 'top', 0.3, 0.4);

    // panel
    const pad = s * 0.025;
    roundRect(ctx, box.x - pad, box.y - pad * 1.8, box.w + pad * 2, box.h + pad * 2.8, s * 0.02);
    ctx.fillStyle = 'rgba(4,4,10,0.72)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.003);
    ctx.strokeStyle = rgba(f.color.accent, 0.25 + a.beat * 0.55);
    ctx.stroke();
    ctx.drawImage(st.off, box.x, box.y);

    // beat lights along the top of the panel
    const nl = 8, lit = a.beats % nl;
    for (let i = 0; i < nl; i++) {
      const lx = box.x + box.w * ((i + 0.5) / nl);
      ctx.beginPath();
      ctx.arc(lx, box.y - pad * 0.9, s * 0.006, 0, TAU);
      ctx.fillStyle = i === lit ? rgba(f.color.accent, 0.5 + a.beat * 0.5) : 'rgba(255,255,255,0.1)';
      ctx.fill();
    }

    const green = '#36ff7a', yellow = '#ffd83a', red = '#ff3b4a';
    const colorAt = (r) => (r < rows * 0.5 ? green : r < rows * 0.72 ? yellow : red);
    const vals = resample(a.bands.subarray(0, 52), cols, st.tmp);
    const bx = cw * 0.1, bw = cw * 0.8, bh = ch * 0.76;
    for (let i = 0; i < cols; i++) {
      const target = clamp(vals[i] * (0.85 + 0.25 * (i / cols)) * (1 + a.kick * 0.15));
      st.v[i] = target > st.v[i] ? lerp(st.v[i], target, 0.7) : lerp(st.v[i], target, 0.18);
      const lvl = Math.round(st.v[i] * rows);
      // peak cap: holds, then falls
      if (lvl >= st.peak[i]) { st.peak[i] = lvl; st.hold[i] = 0.4; st.pv[i] = 0; }
      else if ((st.hold[i] -= f.dt) < 0) {
        st.pv[i] += rows * 3 * f.dt;
        st.peak[i] = Math.max(lvl, st.peak[i] - st.pv[i] * f.dt);
      }
      const x = box.x + i * cw;
      for (let r = 0; r < lvl; r++) {
        ctx.fillStyle = colorAt(r);
        ctx.fillRect(x + bx, box.y + box.h - (r + 1) * ch + ch * 0.12, bw, bh);
      }
      if (lvl > 0) {
        // soft halo on the lit part
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(colorAt(lvl - 1), 0.1);
        ctx.fillRect(x - cw * 0.1, box.y + box.h - lvl * ch, cw * 1.2, lvl * ch);
        // reflection under the panel
        for (let r = 0; r < Math.min(lvl, 3); r++) {
          ctx.fillStyle = rgba(colorAt(r), 0.16 - r * 0.05);
          ctx.fillRect(x + bx, box.y + box.h + pad * 0.4 + r * ch * 0.7, bw, bh * 0.6);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      const pr = Math.min(rows - 1, Math.floor(st.peak[i]));
      if (st.peak[i] > 0.5) {
        ctx.fillStyle = mix(f.color.accent, '#ffffff', 0.45);
        ctx.fillRect(x + bx, box.y + box.h - (pr + 1) * ch + ch * 0.12, bw, bh);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    shadeLayer(ctx, f, st, (g, sf) => vignette(g, sf, 0.45));
  },
};

// ---------- 6. Kaleidoscope ----------
const kaleido = {
  id: 'kaleido',
  name: 'Kaleidoscope',
  ne: 'क्यालिडोस्कोप',
  cat: 'dance',
  text: (f) => ({
    title: { y: 0.5 - 0.022 * f.s / f.h, font: 'baloo', style: 'glow', size: 0.068 },
    sub: { y: 0.5 + 0.06 * f.s / f.h, font: 'baloo', style: 'glow', color: 'accent', size: 0.036, opacity: 1 },
  }),
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

export default [neonTunnel, lasers, synthwave, confetti, ledEq, kaleido];
