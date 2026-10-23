// Hip-hop & rap looks: dark, cinematic, photo first, and the kick hits hard.
import {
  TAU, clamp, lerp, rgba, mix, shade, rng, noise1, resample, mirrored, ease,
  drawCover, circlePhoto, slowZoom, fadeEdge, vignette, smoothLine, smoothLoop, withGlow,
} from '../helpers.js';

const GOLD = '#f2c14e';
const GOLD_DARK = '#9c6b12';
const GOLD_LIGHT = '#fff0b8';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Scaling a big image is the slow part of a frame, and so are full-screen
// gradients. Anything that does not move is painted once into a layer and
// copied each frame at 1:1, which is cheap.
function layer(st, name, w, h, key, paint) {
  let o = st[name];
  if (!o || o.w !== w || o.h !== h || o.key !== key) {
    const c = makeCanvas(w, h);
    paint(c.getContext('2d'));
    o = st[name] = { c, w, h, key };
  }
  return o.c;
}

// Fast rise, slower fall, independent of frame rate.
const follow = (cur, target, dt, up = 30, down = 7) =>
  cur + (target - cur) * (1 - Math.exp(-dt * (target > cur ? up : down)));

// Small random jolt of the whole picture on each kick.
function kickShake(ctx, f, amount) {
  const k = amount * f.a.kick * f.s;
  ctx.translate(noise1(f.t * 30, 1) * k, noise1(f.t * 30, 2) * k);
}

// Soft glow round the current path: wide faint strokes under the line.
function glowStroke(ctx, color, width, strength = 1) {
  for (const [k, al] of [[6, 0.07], [3.5, 0.12], [2, 0.22]]) {
    ctx.lineWidth = width * k;
    ctx.strokeStyle = rgba(color, al * strength);
    ctx.stroke();
  }
}

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

// Film grain painted once per size, then copied at a random offset each frame.
let grainLayer = null;
function grit(ctx, f, amount = 0.1) {
  const pad = 64;
  if (!grainLayer || grainLayer.width !== f.w + pad || grainLayer.height !== f.h + pad) {
    grainLayer = makeCanvas(f.w + pad, f.h + pad);
    const g = grainLayer.getContext('2d');
    const W = grainLayer.width, H = grainLayer.height;
    const d = g.createImageData(W, H);
    const p = d.data;
    const r = rng(11);
    const b = Math.max(1, Math.round(f.s / 540));
    for (let y = 0; y < H; y += b) {
      for (let x = 0; x < W; x += b) {
        const v = r();
        const c = v > 0.5 ? 255 : 0;
        const al = Math.abs(v - 0.5) * 510;
        for (let yy = y; yy < Math.min(H, y + b); yy++) {
          for (let xx = x; xx < Math.min(W, x + b); xx++) {
            const i = (yy * W + xx) * 4;
            p[i] = p[i + 1] = p[i + 2] = c;
            p[i + 3] = al;
          }
        }
      }
    }
    g.putImageData(d, 0, 0);
  }
  ctx.globalAlpha = amount;
  ctx.drawImage(grainLayer, -Math.floor(Math.random() * pad), -Math.floor(Math.random() * pad));
  ctx.globalAlpha = 1;
}

// Red-only and green-blue-only copies of the photo, made once per photo.
// Added together with 'lighter' they give back the photo; pushed apart they
// split the colours.
function splitCopies(st, img) {
  if (st.splitSrc === img) return st.split;
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const make = (tint) => {
    const c = makeCanvas(img.width * k, img.height * k);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  st.split = { red: make('#ff0000'), cyan: make('#00ffff') };
  st.splitSrc = img;
  return st.split;
}

// Full-frame photo with its red half pushed by (-dx, -dy) and the rest by
// (dx, dy), plus a sideways shift ox. zoom must leave room past the edges.
// A tiny push draws the plain photo, which costs a third as much.
function splitPhoto(ctx, f, st, zoom, fx, fy, dx, dy, ox = 0) {
  if (Math.abs(dx) + Math.abs(dy) < f.s * 0.0015) {
    drawCover(ctx, f.photo.sharp, ox, 0, f.w, f.h, zoom, fx, fy);
    return;
  }
  const sp = splitCopies(st, f.photo.sharp);
  drawCover(ctx, sp.cyan, ox + dx, dy, f.w, f.h, zoom, fx, fy);
  ctx.globalCompositeOperation = 'lighter';
  drawCover(ctx, sp.red, ox - dx, -dy, f.w, f.h, zoom, fx, fy);
  ctx.globalCompositeOperation = 'source-over';
}

// Thin dark lines like an old monitor, from a cached tile.
let scanTile = null;
function scanlines(ctx, f, alpha = 0.18) {
  if (!scanTile) {
    scanTile = makeCanvas(2, 4);
    const g = scanTile.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 2, 2, 2);
  }
  const scale = Math.max(1, f.s / 540);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.scale(scale, scale);
  ctx.fillStyle = ctx.createPattern(scanTile, 'repeat');
  ctx.fillRect(0, 0, f.w / scale + 4, f.h / scale + 4);
  ctx.restore();
}

// A soft cloud of smoke, painted once per colour from overlapping soft dots.
// Twice as wide as tall, and fully clear at its edges.
const smokeSprites = {};
function smokeSprite(color) {
  if (smokeSprites[color]) return smokeSprites[color];
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const r = rng(5);
  for (let i = 0; i < 40; i++) {
    const x = W * (0.25 + r() * 0.5), y = H * (0.42 + r() * 0.16), rad = W * (0.09 + r() * 0.07);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba(color, 0.07));
    gr.addColorStop(0.5, rgba(color, 0.035));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  smokeSprites[color] = c;
  return c;
}

// Clouds that drift slowly sideways across the frame.
function makePuffs(seed, n) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x0: r() * 1.6, y: 0.1 + r() * 0.85, sc: 0.8 + r() * 1.0, sp: 0.008 + r() * 0.016,
      rot: (r() - 0.5) * 0.5, ph: r() * 10, flip: r() < 0.5 ? -1 : 1, al: 0.55 + r() * 0.45,
    });
  }
  return out;
}

// Darkening and smoke together, painted at a quarter of the size and
// stretched over the frame in one draw. Both are soft, so nothing is lost.
// paintDark(g, qf) paints the still part once; the smoke is added each frame.
function drawSmoke(ctx, f, st, puffs, sprite, alpha, key, paintDark) {
  const q = 4;
  const lw = Math.ceil(f.w / q), lh = Math.ceil(f.h / q);
  const dark = layer(st, 'darkQ', lw, lh, key, (d) => paintDark(d, { w: lw, h: lh, s: f.s / q }));
  if (!st.smokeC || st.smokeC.width !== lw || st.smokeC.height !== lh) st.smokeC = makeCanvas(lw, lh);
  const g = st.smokeC.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, lw, lh);
  g.drawImage(dark, 0, 0);
  g.globalCompositeOperation = 'lighter';
  g.save();
  g.scale(1 / q, 1 / q);
  drawPuffs(g, f, puffs, sprite, alpha);
  g.restore();
  ctx.drawImage(st.smokeC, 0, 0, f.w, f.h);
}

function drawPuffs(ctx, f, puffs, sprite, alpha) {
  const { w, h, s, t } = f;
  for (const p of puffs) {
    const pw = s * p.sc * 1.8;
    const x = ((p.x0 + t * p.sp) % 1.6 - 0.3) * w;
    const y = p.y * h + Math.sin(t * 0.15 + p.ph) * s * 0.02;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot + Math.sin(t * 0.07 + p.ph) * 0.12);
    ctx.scale(p.flip, 1);
    ctx.globalAlpha = clamp(alpha * p.al);
    ctx.drawImage(sprite, -pw / 2, -pw / 6, pw, pw / 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------- 1. Bass Punch ----------
const bassPunch = {
  id: 'bass-punch',
  name: 'Bass Punch',
  ne: 'बेस पन्च',
  cat: 'hiphop',
  text: (f) => ({
    title: { y: f.portrait ? 0.13 : 0.12, size: f.portrait ? 0.11 : 0.085, font: 'khand', upper: true, style: 'outline' },
    sub: { y: f.portrait ? 0.185 : 0.205, size: f.portrait ? 0.05 : 0.036, font: 'bebas', upper: true, style: 'tag', color: GOLD },
  }),
  setup: () => ({ raw: new Float32Array(40), bars: new Float32Array(40), side: 1, beats: -1 }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    if (a.beats !== st.beats) { st.beats = a.beats; st.side = a.beats % 2 ? 1 : -1; }

    // Hard zoom on the kick, colours tear apart on the beat.
    const z = slowZoom(f, 0.06);
    const zoom = z.zoom * (1.05 + a.kick * 0.13);
    const d = s * 0.022 * a.beat * a.beat;
    splitPhoto(ctx, f, st, zoom, z.fx, z.fy, d * st.side, d * 0.25);

    // Ghost copy that blooms out of the photo on the kick.
    if (a.kick > 0.25) {
      ctx.globalAlpha = 0.3 * a.kick;
      drawCover(ctx, f.photo.sharp, 0, 0, w, h, zoom * (1.05 + a.kick * 0.08), z.fx, z.fy);
      ctx.globalAlpha = 1;
    }
    const floorY = h - s * (f.portrait ? 0.16 : 0.13);
    ctx.drawImage(layer(st, 'over', w, h, 'punch', (g) => {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, 0, w, h);
      fadeEdge(g, f, 'top', 0.3, 0.55);
      vignette(g, f, 0.6);
      // Black floor the bars rise out of.
      const fg = g.createLinearGradient(0, floorY - s * 0.3, 0, floorY);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = fg;
      g.fillRect(0, floorY - s * 0.3, w, s * 0.3);
      g.fillStyle = '#050505';
      g.fillRect(0, floorY, w, h - floorY);
    }), 0, 0);

    // Heavy gold bars, bass in the middle.
    const n = f.portrait ? 18 : f.square ? 24 : 36;
    const raw = mirrored(a.bands.subarray(0, 46), n);
    const slot = w / n, bw = slot * 0.7;
    const maxH = s * (f.portrait ? 0.36 : 0.34);
    const gold = ctx.createLinearGradient(0, floorY - maxH, 0, floorY);
    gold.addColorStop(0, GOLD_LIGHT);
    gold.addColorStop(0.35, GOLD);
    gold.addColorStop(1, GOLD_DARK);
    for (let i = 0; i < n; i++) {
      const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      const v = clamp(raw[i] * (0.75 + 0.3 * mid) + a.kick * 0.32 * mid * mid);
      st.bars[i] = v > st.bars[i] ? v : Math.max(v, st.bars[i] - f.dt * 2.2);
      const bh = Math.max(s * 0.008, st.bars[i] * maxH);
      const x = i * slot + (slot - bw) / 2;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - s * 0.004, floorY - bh - s * 0.004, bw + s * 0.008, bh + s * 0.004);
      ctx.fillStyle = gold;
      ctx.fillRect(x, floorY - bh, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x, floorY - bh, bw, Math.max(1, s * 0.004));
      // Dim reflection in the black floor.
      ctx.fillStyle = rgba(GOLD, 0.16);
      ctx.fillRect(x, floorY + s * 0.008, bw, bh * 0.35);
    }
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, floorY, w, Math.max(2, s * 0.005));
    grit(ctx, f, 0.07);
  },
};

// ---------- 2. Trap Ring ----------
function ringLayout(f) {
  const { w, h, s } = f;
  if (f.portrait) return { cx: w / 2, cy: h * 0.42, r: s * 0.27, amp: s * 0.14 };
  if (f.square) return { cx: w / 2, cy: h * 0.42, r: s * 0.18, amp: s * 0.1 };
  return { cx: w / 2, cy: h * 0.43, r: s * 0.19, amp: s * 0.105 };
}

const RING_HALF = 56;
const RING_N = 2 * (RING_HALF - 1);
const RING_DOTS = 150;

const trapRing = {
  id: 'trap-ring',
  name: 'Trap Ring',
  ne: 'ट्र्याप रिङ',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.76, size: 0.11, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.805, size: 0.048, font: 'bebas', upper: true, style: 'shadow', color: 'accent' } }
    : f.square
      ? { title: { y: 0.845, size: 0.072, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.91, size: 0.036, font: 'bebas', upper: true, style: 'shadow', color: 'accent' } }
      : { title: { y: 0.855, size: 0.075, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.925, size: 0.034, font: 'bebas', upper: true, style: 'shadow', color: 'accent' } }),
  setup(f) {
    const r = rng(9);
    const dMax = Math.hypot(f.w, f.h) * 0.6 / f.s;
    const an = new Float32Array(RING_DOTS), d = new Float32Array(RING_DOTS);
    const sp = new Float32Array(RING_DOTS), sz = new Float32Array(RING_DOTS);
    for (let i = 0; i < RING_DOTS; i++) {
      an[i] = r() * TAU;
      d[i] = 0.15 + r() * (dMax - 0.15);
      sp[i] = 0.5 + r();
      sz[i] = 0.0012 + r() * r() * 0.0035;
    }
    return {
      r, dMax, an, d, sp, sz,
      half: new Float32Array(RING_HALF), soft: new Float32Array(RING_HALF),
      v0: new Float32Array(RING_HALF), v1: new Float32Array(RING_HALF), v2: new Float32Array(RING_HALF),
      pts: Array.from({ length: RING_N }, () => [0, 0]),
      puffs: makePuffs(31, 6),
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const k = a.kick;
    const L = ringLayout(f);
    const { cx, cy } = L;
    const acc = f.color.accent, acc2 = f.color.accent2;

    // Dark, smoky backdrop from the blurred photo.
    const z = slowZoom(f, 0.1);
    ctx.save();
    kickShake(ctx, f, 0.012);
    drawCover(ctx, f.photo.blur, 0, 0, w, h, z.zoom * (1.12 + k * 0.05), z.fx, z.fy);
    ctx.restore();
    drawSmoke(ctx, f, st, st.puffs, smokeSprite(shade(acc, 0.1)), 0.22 + a.bass * 0.18, 'ring', (g, qf) => {
      g.fillStyle = 'rgba(0,0,0,0.68)';
      g.fillRect(0, 0, qf.w, qf.h);
      vignette(g, qf, 0.85);
    });

    ctx.save();
    kickShake(ctx, f, 0.01);
    const R = L.r * (1 + k * 0.07);

    // Glow behind the ring, swelling with the bass.
    const gR = R + L.amp * 2;
    const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, gR);
    glow.addColorStop(0, rgba(acc, 0.32 + a.bass * 0.25));
    glow.addColorStop(1, rgba(acc, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(cx - gR, cy - gR, gR * 2, gR * 2);

    // Particles drift outward, and rush out on the kick.
    const rs = R / s;
    const speed = 0.04 + a.bass * 0.1 + k * 0.45;
    const swirl = f.t * 0.04;
    const bucket = [[], [], []];
    for (let i = 0; i < RING_DOTS; i++) {
      st.d[i] += f.dt * st.sp[i] * speed;
      if (st.d[i] > st.dMax) {
        st.d[i] = rs * 0.95 + st.r() * 0.05;
        st.an[i] = st.r() * TAU;
      }
      const fade = clamp((st.d[i] - rs) / 0.08) * (1 - st.d[i] / st.dMax);
      if (fade <= 0.05) continue;
      bucket[fade > 0.55 ? 0 : fade > 0.28 ? 1 : 2].push(i);
    }
    ctx.fillStyle = '#ffffff';
    [0.85, 0.5, 0.22].forEach((al, b) => {
      ctx.globalAlpha = al;
      ctx.beginPath();
      for (const i of bucket[b]) {
        const an = st.an[i] + swirl;
        const x = cx + Math.cos(an) * st.d[i] * s, y = cy + Math.sin(an) * st.d[i] * s;
        const pr = st.sz[i] * s;
        ctx.moveTo(x + pr, y);
        ctx.arc(x, y, pr, 0, TAU);
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Mirrored spectrum around the circle: bass at the top, three layers that
    // follow at different speeds so the ring has depth.
    const half = resample(a.bands.subarray(0, 44), RING_HALF, st.half);
    for (let i = 0; i < RING_HALF; i++) {
      const p = half[Math.max(0, i - 1)], q = half[Math.min(RING_HALF - 1, i + 1)];
      st.soft[i] = (p + half[i] * 2 + q) / 4;
    }
    for (let i = 0; i < RING_HALF; i++) {
      // Lift the detail out of the spectrum so the ring is never a flat donut.
      const wig = 0.78 + 0.22 * Math.sin(i * 0.42 + f.t * 2.2) * Math.cos(i * 0.19 - f.t * 1.1);
      const v = clamp((st.soft[i] - 0.18) * 1.5 * wig + k * 0.3 * (1 - i / RING_HALF));
      st.v0[i] = follow(st.v0[i], v, f.dt, 32, 9);
      st.v1[i] = follow(st.v1[i], st.v0[i], f.dt, 8, 3);
      st.v2[i] = follow(st.v2[i], st.v0[i], f.dt, 4, 1.6);
    }
    const loop = (arr, scale) => {
      for (let i = 0; i < RING_N; i++) {
        const j = i < RING_HALF ? i : RING_N - i;
        const th = -Math.PI / 2 + (i / RING_N) * TAU;
        const rr = R + s * 0.01 + arr[j] * L.amp * scale;
        st.pts[i][0] = cx + Math.cos(th) * rr;
        st.pts[i][1] = cy + Math.sin(th) * rr;
      }
      ctx.beginPath();
      smoothLoop(ctx, st.pts);
    };
    loop(st.v2, 1.55);
    ctx.fillStyle = rgba(acc2, 0.5);
    ctx.fill();
    loop(st.v1, 1.2);
    ctx.fillStyle = rgba(mix(acc, acc2, 0.3), 0.85);
    ctx.fill();
    loop(st.v0, 0.55);
    ctx.lineJoin = 'round';
    glowStroke(ctx, shade(acc, 0.2), s * 0.006, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // The photo, with a rim that flashes on the kick.
    ctx.beginPath();
    ctx.arc(cx, cy, R + s * 0.006, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    circlePhoto(ctx, f, cx, cy, R, 1.08 + k * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    glowStroke(ctx, shade(acc, 0.4), s * 0.005, 0.4 + k * 1.2);
    ctx.lineWidth = Math.max(2, s * (0.005 + k * 0.004));
    ctx.strokeStyle = rgba(mix('#ffffff', acc, 0.25 * (1 - k)), 0.65 + k * 0.35);
    ctx.stroke();
    ctx.restore();
  },
};

// ---------- 3. Chrome Bars ----------
const chrome = {
  id: 'chrome',
  name: 'Chrome Bars',
  ne: 'क्रोम बार',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.14, size: 0.12, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.19, size: 0.05, font: 'bebas', upper: true, style: 'shadow', color: '#d9dde3' } }
    : { title: { y: 0.13, size: 0.088, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.21, size: 0.038, font: 'bebas', upper: true, style: 'shadow', color: '#d9dde3' } }),
  setup: (f) => {
    const n = f.portrait ? 22 : f.square ? 30 : 44;
    return { n, v: new Float32Array(n), peak: new Float32Array(n), hold: new Float32Array(n) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const acc = f.color.accent, acc2 = f.color.accent2;
    const z = slowZoom(f, 0.06);
    drawCover(ctx, f.photo.gray, 0, 0, w, h, z.zoom * (1.03 + a.kick * 0.035), z.fx, z.fy);

    const base = h * 0.8;
    const maxH = s * (f.portrait ? 0.3 : 0.29);
    ctx.drawImage(layer(st, 'over', w, h, 'chrome', (g) => {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(0, 0, w, h);
      fadeEdge(g, f, 'top', 0.32, 0.6);
      vignette(g, f, 0.6);
      const fg = g.createLinearGradient(0, base - s * 0.34, 0, base);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(1, 'rgba(0,0,0,0.8)');
      g.fillStyle = fg;
      g.fillRect(0, base - s * 0.34, w, s * 0.34);
      const fl = g.createLinearGradient(0, base, 0, h);
      fl.addColorStop(0, 'rgba(4,4,6,0.9)');
      fl.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = fl;
      g.fillRect(0, base, w, h - base);
    }), 0, 0);

    // Coloured rim light from both sides, a little brighter on the beat.
    const rim = 0.3 + a.beat * 0.2;
    ctx.globalCompositeOperation = 'screen';
    let g = ctx.createLinearGradient(0, 0, w * 0.42, 0);
    g.addColorStop(0, rgba(acc, rim));
    g.addColorStop(1, rgba(acc, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w * 0.42, base);
    g = ctx.createLinearGradient(w, 0, w * 0.58, 0);
    g.addColorStop(0, rgba(acc2, rim * 0.8));
    g.addColorStop(1, rgba(acc2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(w * 0.58, 0, w * 0.42, base);
    ctx.globalCompositeOperation = 'source-over';

    // Bar heights: bass in the middle, quick up, slower down, peak caps.
    const n = st.n;
    const m = mirrored(a.bands.subarray(0, 46), n);
    for (let i = 0; i < n; i++) {
      const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      const v = clamp(m[i] * (0.7 + 0.35 * mid) + a.kick * 0.28 * mid * mid);
      st.v[i] = follow(st.v[i], v, f.dt, 30, 6);
      if (st.v[i] >= st.peak[i]) { st.peak[i] = st.v[i]; st.hold[i] = 0.4; }
      else if ((st.hold[i] -= f.dt) <= 0) st.peak[i] = Math.max(st.v[i], st.peak[i] - f.dt * 0.5);
    }
    const side = w * 0.05;
    const slot = (w - side * 2) / n, bw = slot * 0.72;
    const minH = s * 0.012;
    const xAt = (i) => side + i * slot + (slot - bw) / 2;

    // Polished metal: bright top, dark horizon band, bright again below.
    const cg = ctx.createLinearGradient(0, base - maxH, 0, base);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.2, '#c9ced6');
    cg.addColorStop(0.46, '#5d636d');
    cg.addColorStop(0.5, '#16181d');
    cg.addColorStop(0.56, '#3a3f47');
    cg.addColorStop(0.72, '#c4c9d1');
    cg.addColorStop(0.84, '#f4f5f7');
    cg.addColorStop(1, '#575c64');
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = minH + st.v[i] * maxH;
      ctx.rect(xAt(i), base - bh, bw, bh);
    }
    ctx.fillStyle = cg;
    ctx.fill();
    // Coloured edge on each bar where the rim light catches it.
    const e = Math.max(1, bw * 0.12);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = minH + st.v[i] * maxH;
      const x = xAt(i);
      ctx.rect(i < n / 2 ? x : x + bw - e, base - bh, e, bh);
    }
    ctx.fillStyle = rgba(mix(acc, '#ffffff', 0.15), 0.85);
    ctx.fill();
    // White top edge.
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.rect(xAt(i), base - minH - st.v[i] * maxH, bw, Math.max(1, s * 0.003));
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Reflection in the dark floor.
    const gap = s * 0.008;
    const rg = ctx.createLinearGradient(0, base + gap, 0, base + gap + maxH * 0.4);
    rg.addColorStop(0, 'rgba(210,215,225,0.32)');
    rg.addColorStop(1, 'rgba(210,215,225,0)');
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.rect(xAt(i), base + gap, bw, (minH + st.v[i] * maxH) * 0.4);
    ctx.fillStyle = rg;
    ctx.fill();

    // Floating caps and the floor line, in the accent colour.
    ctx.beginPath();
    const capH = Math.max(2, s * 0.006);
    for (let i = 0; i < n; i++) ctx.rect(xAt(i), base - minH - st.peak[i] * maxH - gap - capH, bw, capH);
    withGlow(ctx, rgba(acc, 0.9), s * 0.015, () => {
      ctx.fillStyle = shade(acc, 0.3);
      ctx.fill();
      ctx.fillRect(side, base + gap * 0.25, w - side * 2, Math.max(1, s * 0.002));
    });
  },
};

// ---------- 4. Smoke ----------
// Dark, nearly colourless copy of the photo, made once per photo.
function mutedPhoto(st, photo) {
  if (st.mutedSrc === photo.sharp) return st.muted;
  const c = makeCanvas(photo.gray.width, photo.gray.height);
  const g = c.getContext('2d');
  g.drawImage(photo.gray, 0, 0, c.width, c.height);
  g.globalAlpha = 0.3;
  g.drawImage(photo.sharp, 0, 0, c.width, c.height);
  // Multiply by itself for deep, moody shadows.
  g.globalAlpha = 0.7;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(c, 0, 0);
  st.muted = c;
  st.mutedSrc = photo.sharp;
  return c;
}

const SMOKE_N = 120;

const smoke = {
  id: 'smoke',
  name: 'Smoke',
  ne: 'धुवाँ',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.66, size: 0.15, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.715, size: 0.052, font: 'bebas', upper: true, style: 'shadow', color: '#ececec', opacity: 0.9 } }
    : f.square
      ? { title: { y: 0.66, size: 0.12, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.745, size: 0.042, font: 'bebas', upper: true, style: 'shadow', color: '#ececec', opacity: 0.9 } }
      : { title: { y: 0.64, size: 0.12, font: 'teko', upper: true, style: 'shadow' }, sub: { y: 0.735, size: 0.042, font: 'bebas', upper: true, style: 'shadow', color: '#ececec', opacity: 0.9 } }),
  setup: () => ({
    puffs: makePuffs(21, 8), v: new Float32Array(SMOKE_N), e: new Float32Array(SMOKE_N),
    raw: new Float32Array(SMOKE_N), pts: Array.from({ length: SMOKE_N }, () => [0, 0]), peak: 0.3,
  }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const acc = f.color.accent;
    const z = slowZoom(f, 0.08);
    drawCover(ctx, mutedPhoto(st, f.photo), 0, 0, w, h, z.zoom * (1.03 + a.kick * 0.025), z.fx, z.fy);
    // Slow smoke, a touch thicker when the bass is loud.
    drawSmoke(ctx, f, st, st.puffs, smokeSprite(mix('#ffffff', acc, 0.15)), 0.4 + a.bass * 0.3, 'smoke', (g, qf) => {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, 0, qf.w, qf.h);
      fadeEdge(g, qf, 'bottom', 0.45, 0.85);
      fadeEdge(g, qf, 'top', 0.25, 0.4);
      vignette(g, qf, 0.7);
    });

    // The waveform, averaged and smoothed into one calm line.
    const n = SMOKE_N, wave = a.wave, win = 16;
    let pk = 0;
    for (let i = 0; i < n; i++) {
      const j = Math.floor((i / (n - 1)) * (wave.length - win));
      let sum = 0;
      for (let q = 0; q < win; q++) sum += wave[j + q];
      st.raw[i] = sum / win;
      pk = Math.max(pk, Math.abs(st.raw[i]));
    }
    st.peak = pk > st.peak ? pk : lerp(st.peak, pk, 0.03);
    const norm = 1 / Math.max(0.12, st.peak);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const taper = Math.pow(Math.sin(Math.PI * x), 1.4);
      st.v[i] = lerp(st.v[i], st.raw[i] * norm * taper, 0.45);
      st.e[i] = lerp(st.e[i], st.v[i], 0.08);
    }
    const cy = h * (f.portrait ? 0.86 : 0.88);
    const amp = s * (f.portrait ? 0.07 : 0.06) * (0.6 + a.level * 0.6 + a.kick * 0.4);

    // Soft band of coloured light along the line.
    const bandH = s * 0.12;
    const bg = ctx.createLinearGradient(0, cy - bandH, 0, cy + bandH);
    bg.addColorStop(0, rgba(acc, 0));
    bg.addColorStop(0.5, rgba(acc, 0.1 + a.bass * 0.12));
    bg.addColorStop(1, rgba(acc, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = bg;
    ctx.fillRect(0, cy - bandH, w, bandH * 2);
    ctx.globalCompositeOperation = 'source-over';

    const line = (arr, scale) => {
      for (let i = 0; i < n; i++) {
        st.pts[i][0] = w * 0.04 + (i / (n - 1)) * w * 0.92;
        st.pts[i][1] = cy - arr[i] * amp * scale;
      }
      ctx.beginPath();
      smoothLine(ctx, st.pts);
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    line(st.e, -1.3);
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = rgba(shade(f.color.accent2, 0.2), 0.4);
    ctx.stroke();
    line(st.v, 1);
    // Glow from a few wide see-through strokes: much cheaper than shadowBlur.
    glowStroke(ctx, acc, s * 0.006, 0.7 + a.beat * 0.3);
    ctx.lineWidth = Math.max(2, s * 0.006);
    ctx.strokeStyle = shade(acc, 0.25);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  },
};

// ---------- 5. Spotlight ----------
const DUST_N = 130;
const BEAM_SPREAD = 0.16;
const BEAM_W = Math.tan(BEAM_SPREAD) * 1.15;

// One soft cone of light pointing down from its tip at the top centre,
// brightest in the middle and near the lamp. Painted once, then rotated.
let beamTex = null;
function beamSprite() {
  if (beamTex) return beamTex;
  const H = 512, W = Math.round(H * BEAM_W * 2);
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const steps = 18;
  g.fillStyle = 'rgba(255,255,255,' + (1 / steps) + ')';
  for (let i = 1; i <= steps; i++) {
    const sp = Math.tan(BEAM_SPREAD * (i / steps)) * H;
    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2 + sp, H);
    g.lineTo(W / 2 - sp, H);
    g.closePath();
    g.fill();
  }
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.6, 'rgba(0,0,0,0.55)');
  fade.addColorStop(1, 'rgba(0,0,0,0.15)');
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  beamTex = c;
  return c;
}

const spotlight = {
  id: 'spotlight',
  name: 'Spotlight',
  ne: 'स्पटलाइट',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.13, size: 0.12, font: 'khand', upper: true, style: 'shadow' }, sub: { y: 0.18, size: 0.05, font: 'bebas', upper: true, style: 'shadow', color: GOLD } }
    : { title: { y: 0.13, size: 0.088, font: 'khand', upper: true, style: 'shadow' }, sub: { y: 0.21, size: 0.038, font: 'bebas', upper: true, style: 'shadow', color: GOLD } }),
  setup: (f) => {
    const r = rng(17);
    const n = f.portrait ? 40 : f.square ? 54 : 72;
    const dust = [];
    for (let i = 0; i < DUST_N; i++) {
      dust.push({ x: r(), y: r(), vx: (r() - 0.5) * 0.01, vy: 0.004 + r() * 0.01, ph: r() * 10, sz: 0.001 + r() * r() * 0.0028 });
    }
    return { n, v: new Float32Array(n), dust, sw: 0, beats: -1 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const z = slowZoom(f, 0.06);
    drawCover(ctx, f.photo.gray, 0, 0, w, h, z.zoom * (1.03 + a.kick * 0.025), z.fx, z.fy);
    const base = h - s * (f.portrait ? 0.12 : 0.075);

    // The beams swing to a new place every two beats, and drift a little.
    const target = (Math.floor(a.beats / 2) % 2 ? 0.2 : -0.12) + 0.06 * Math.sin(f.t * 0.7);
    st.sw = follow(st.sw, target, f.dt, 3.5, 3.5);
    const sy = -s * 0.1;
    const warm = mix('#fff1d6', f.color.accent, 0.12);
    const len = Math.hypot(w, h) * 1.3;
    const beams = [-1, 1].map((side) => {
      const sx = w * (0.5 + side * 0.36);
      const aim = Math.atan2(w * 0.5 - sx, h * 0.72 - sy);
      return { sx, dir: aim - side * st.sw };
    });
    const lift = 1 + a.kick * 0.3;
    // Both beams go into one quarter-size light map. One quarter-size shade
    // darkens the photo everywhere except under the beams, and carries a
    // faint haze where the light is. Stretched over the frame in one draw.
    const q = 4;
    const mw = Math.ceil(w / q), mh = Math.ceil(h / q);
    const dark = layer(st, 'dark', mw, mh, 'spot', (d) => {
      const qf = { w: mw, h: mh, s: s / q };
      d.fillStyle = 'rgba(0,0,0,0.6)';
      d.fillRect(0, 0, mw, mh);
      vignette(d, qf, 0.7);
      fadeEdge(d, qf, 'bottom', 0.3, 0.85);
    });
    if (!st.map || st.map.width !== mw || st.map.height !== mh) st.map = makeCanvas(mw, mh);
    const g = st.map.getContext('2d');
    g.clearRect(0, 0, mw, mh);
    g.globalCompositeOperation = 'lighter';
    const sprite = beamSprite();
    const bw2 = len * BEAM_W / q;
    for (const b of beams) {
      g.save();
      g.translate(b.sx / q, sy / q);
      g.rotate(-b.dir);
      g.drawImage(sprite, -bw2, 0, bw2 * 2, len / q);
      g.restore();
    }
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = warm;
    g.fillRect(0, 0, mw, mh);
    if (!st.shadeC || st.shadeC.width !== mw || st.shadeC.height !== mh) st.shadeC = makeCanvas(mw, mh);
    const sh = st.shadeC.getContext('2d');
    sh.globalCompositeOperation = 'source-over';
    sh.clearRect(0, 0, mw, mh);
    sh.drawImage(dark, 0, 0);
    sh.globalCompositeOperation = 'destination-out';
    sh.globalAlpha = clamp(0.75 * lift);
    sh.drawImage(st.map, 0, 0);
    sh.globalCompositeOperation = 'destination-over';
    sh.globalAlpha = clamp(0.45 * lift);
    sh.drawImage(st.map, 0, 0);
    sh.globalAlpha = 1;
    ctx.drawImage(st.shadeC, 0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of beams) {
      // Glow where the lamp sits, just above the frame.
      const gr = s * 0.28;
      const sg = ctx.createRadialGradient(b.sx, 0, 0, b.sx, 0, gr);
      sg.addColorStop(0, rgba(warm, 0.3));
      sg.addColorStop(1, rgba(warm, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(b.sx - gr, 0, gr * 2, gr);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Dust, only visible where it floats through a beam.
    const bucket = [[], [], []];
    const pos = st.dust;
    for (let i = 0; i < DUST_N; i++) {
      const d = pos[i];
      const px = (((d.x + f.t * d.vx + 0.015 * Math.sin(f.t * 0.4 + d.ph)) % 1) + 1) % 1 * w;
      const py = (((d.y - f.t * d.vy) % 1) + 1) % 1 * h;
      let lit = 0;
      for (const b of beams) {
        const an = Math.atan2(px - b.sx, py - sy);
        lit = Math.max(lit, 1 - Math.abs(an - b.dir) / BEAM_SPREAD);
      }
      if (lit <= 0.05) continue;
      d.px = px; d.py = py;
      bucket[lit > 0.66 ? 0 : lit > 0.33 ? 1 : 2].push(d);
    }
    ctx.fillStyle = warm;
    [0.85, 0.5, 0.22].forEach((al, k) => {
      ctx.globalAlpha = al;
      ctx.beginPath();
      for (const d of bucket[k]) {
        const pr = d.sz * s;
        ctx.moveTo(d.px + pr, d.py);
        ctx.arc(d.px, d.py, pr, 0, TAU);
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Thin gold bars along the bottom.
    const n = st.n;
    const m = mirrored(a.bands.subarray(0, 46), n);
    const side = w * 0.06;
    const slot = (w - side * 2) / n, bw = Math.max(1.5, slot * 0.4);
    const maxH = s * (f.portrait ? 0.16 : 0.15);
    for (let i = 0; i < n; i++) {
      const mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      st.v[i] = follow(st.v[i], clamp(m[i] * (0.65 + 0.4 * mid) + a.kick * 0.25 * mid * mid), f.dt, 30, 7);
    }
    const gold = ctx.createLinearGradient(0, base - maxH, 0, base);
    gold.addColorStop(0, GOLD_LIGHT);
    gold.addColorStop(0.45, GOLD);
    gold.addColorStop(1, GOLD_DARK);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bh = bw + st.v[i] * maxH;
      addPill(ctx, side + i * slot + (slot - bw) / 2, base - bh, bw, bh, bw / 2);
    }
    ctx.fillStyle = gold;
    ctx.fill();
    const gap = s * 0.008;
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.rect(side + i * slot + (slot - bw) / 2, base + gap, bw, (bw + st.v[i] * maxH) * 0.28);
    ctx.fillStyle = rgba(GOLD, 0.2);
    ctx.fill();
    ctx.fillStyle = rgba(GOLD, 0.55);
    ctx.fillRect(side, base + gap * 0.4, w - side * 2, Math.max(1, s * 0.0016));
  },
};

// ---------- 6. Shockwave ----------
const WAVE_N = 64;
const RING_LIFE = 1.2;

const shockwave = {
  id: 'shockwave',
  name: 'Shockwave',
  ne: 'झट्का तरंग',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.12, size: 0.12, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.168, size: 0.05, font: 'bebas', upper: true, style: 'shadow', color: 'accent' } }
    : { title: { y: 0.12, size: 0.088, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.2, size: 0.038, font: 'bebas', upper: true, style: 'shadow', color: 'accent' } }),
  setup: () => ({
    rings: [], beats: -1, v: new Float32Array(WAVE_N), e: new Float32Array(WAVE_N),
    top: Array.from({ length: WAVE_N }, () => [0, 0]), bot: Array.from({ length: WAVE_N }, () => [0, 0]),
  }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const acc = f.color.accent, acc2 = f.color.accent2;
    const cx = w / 2, cy = h * (f.portrait ? 0.45 : 0.46);

    if (a.beats !== st.beats) {
      if (st.beats >= 0 || a.beat > 0.5) st.rings.push({ t: 0 });
      st.beats = a.beats;
      if (st.rings.length > 4) st.rings.shift();
    }
    for (const rg of st.rings) rg.t += f.dt;

    const z = slowZoom(f, 0.06);
    const zoom = z.zoom * (1.04 + a.kick * 0.05);
    const Rmax = Math.hypot(w, h) * 0.55;
    const live = [];
    for (const rg of st.rings) {
      const p = rg.t / RING_LIFE;
      if (p >= 1) continue;
      const e = ease.out(p);
      const r = lerp(s * 0.05, Rmax, e);
      live.push({ r, th: s * (0.03 + 0.07 * e), al: Math.pow(1 - p, 1.3), p });
    }

    ctx.save();
    kickShake(ctx, f, 0.006);
    drawCover(ctx, f.photo.sharp, 0, 0, w, h, zoom, z.fx, z.fy);
    // Inside each ring the photo is magnified a little, like a lens.
    for (const L of live) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, L.r, 0, TAU);
      ctx.arc(cx, cy, Math.max(0, L.r - L.th), 0, TAU, true);
      ctx.clip();
      const mag = 1 + 0.1 * L.al;
      ctx.translate(cx, cy);
      ctx.scale(mag, mag);
      ctx.translate(-cx, -cy);
      ctx.globalAlpha = L.al;
      drawCover(ctx, f.photo.sharp, 0, 0, w, h, zoom, z.fx, z.fy);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    ctx.drawImage(layer(st, 'over', w, h, 'shock', (g) => {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 0, w, h);
      fadeEdge(g, f, 'top', 0.3, 0.55);
      fadeEdge(g, f, 'bottom', 0.45, 0.85);
      vignette(g, f, 0.6);
    }), 0, 0);

    // A burst of colour in the middle on the kick.
    if (a.kick > 0.05) {
      const gr = s * 0.4;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      cg.addColorStop(0, rgba(acc, 0.28 * a.kick));
      cg.addColorStop(1, rgba(acc, 0));
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = cg;
      ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Bright edge of each shockwave.
    for (const L of live) {
      ctx.beginPath();
      ctx.arc(cx, cy, L.r, 0, TAU);
      glowStroke(ctx, acc, s * 0.005, L.al * 1.3);
      ctx.lineWidth = Math.max(1.5, s * 0.005 * (1 - L.p * 0.5));
      ctx.strokeStyle = rgba(mix('#ffffff', acc, 0.2), 0.9 * L.al);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0, L.r - L.th), 0, TAU);
      ctx.lineWidth = Math.max(1, s * 0.002);
      ctx.strokeStyle = rgba(acc, 0.35 * L.al);
      ctx.stroke();
    }

    // Mirrored wave along the bottom: bass in the middle, same up and down.
    const m = mirrored(a.bands.subarray(0, 46), WAVE_N);
    const wl = a.wave.length;
    for (let i = 0; i < WAVE_N; i++) {
      const x = i / (WAVE_N - 1);
      // Texture from the waveform, mirrored so both halves match.
      const wv = Math.abs(a.wave[Math.floor(Math.abs(x - 0.5) * 2 * (wl - 1))]);
      m[i] *= 0.6 + Math.min(1, wv * 1.8) * 0.7;
      const taper = Math.pow(Math.sin(Math.PI * x), 0.8);
      st.v[i] = follow(st.v[i], clamp((m[i] - 0.15) * 1.3 + a.kick * 0.25 * x * (1 - x) * 4) * taper, f.dt, 25, 8);
      st.e[i] = follow(st.e[i], st.v[i], f.dt, 3, 1.5);
    }
    const wy = h * (f.portrait ? 0.85 : 0.855);
    const amp = s * (f.portrait ? 0.1 : 0.085);
    const ribbon = (arr, scale) => {
      for (let i = 0; i < WAVE_N; i++) {
        const x = (i / (WAVE_N - 1)) * w;
        st.top[i][0] = x;
        st.top[i][1] = wy - arr[i] * amp * scale;
        const j = WAVE_N - 1 - i;
        st.bot[j][0] = x;
        st.bot[j][1] = wy + arr[i] * amp * scale;
      }
      ctx.beginPath();
      smoothLine(ctx, st.top);
      smoothLine(ctx, st.bot, false);
      ctx.closePath();
    };
    ribbon(st.e, 1.3);
    ctx.fillStyle = rgba(acc2, 0.3);
    ctx.fill();
    ribbon(st.v, 1);
    const fg = ctx.createLinearGradient(0, 0, w, 0);
    fg.addColorStop(0, rgba(acc2, 0.7));
    fg.addColorStop(0.5, rgba(shade(acc, 0.1), 0.8));
    fg.addColorStop(1, rgba(acc2, 0.7));
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.beginPath();
    smoothLine(ctx, st.top);
    smoothLine(ctx, st.bot);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    glowStroke(ctx, acc, s * 0.0035, 0.8);
    ctx.lineWidth = Math.max(1.5, s * 0.0035);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  },
};

// ---------- 7. Glitch ----------
const GLITCH_N = 110;

const glitch = {
  id: 'glitch',
  name: 'Glitch',
  ne: 'ग्लिच',
  cat: 'hiphop',
  text: (f) => (f.portrait
    ? { title: { y: 0.8, size: 0.12, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.855, size: 0.052, font: 'bebas', upper: true, style: 'tag', color: '#ffffff' } }
    : { title: { y: 0.8, size: 0.085, font: 'teko', upper: true, style: 'outline' }, sub: { y: 0.885, size: 0.036, font: 'bebas', upper: true, style: 'tag', color: '#ffffff' } }),
  setup: () => ({
    beats: -1, cuts: [], wave: new Float32Array(GLITCH_N), raw: new Float32Array(GLITCH_N), peak: 0.3,
    pts: Array.from({ length: GLITCH_N }, () => [0, 0]),
  }),
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const z = slowZoom(f, 0.06);
    const zoom = z.zoom * (1.06 + a.kick * 0.03);

    // A new set of torn slices for every beat, from a seeded random.
    if (a.beats !== st.beats) {
      st.beats = a.beats;
      const r = rng(a.beats * 977 + 13);
      st.cuts.length = 0;
      const nc = 2 + Math.floor(r() * 3);
      for (let i = 0; i < nc; i++) {
        st.cuts.push({ y: 0.08 + r() * 0.5, hh: 0.012 + r() * r() * 0.07, dx: (r() < 0.5 ? -1 : 1) * (0.02 + r() * 0.05), split: 0.5 + r() });
      }
    }
    const g = clamp(a.beat * 1.2) * clamp(a.beat * 1.2);
    const base = s * 0.003 * clamp(a.beat * 2);
    splitPhoto(ctx, f, st, zoom, z.fx, z.fy, base + s * 0.012 * g, 0);

    // Slices of the picture slide sideways, wrapping round the edge.
    if (g > 0.08) {
      for (const c of st.cuts) {
        const y0 = Math.round(c.y * h), hh = Math.max(1, Math.round(c.hh * h));
        const off = Math.round(c.dx * w * g);
        const d = base + s * 0.018 * c.split * g;
        for (const x0 of [off, off - Math.sign(off) * w]) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, y0, w, hh);
          ctx.clip();
          splitPhoto(ctx, f, st, zoom, z.fx, z.fy, d, 0, x0);
          ctx.restore();
        }
        ctx.fillStyle = `rgba(255,255,255,${0.3 * g})`;
        ctx.fillRect(0, y0, w, Math.max(1, s * 0.0015));
      }
    }

    ctx.drawImage(layer(st, 'over', w, h, 'glitch', (o) => {
      o.fillStyle = 'rgba(0,0,0,0.15)';
      o.fillRect(0, 0, w, h);
      fadeEdge(o, f, 'bottom', 0.5, 0.85);
      fadeEdge(o, f, 'top', 0.2, 0.35);
      scanlines(o, f, 0.07);
      vignette(o, f, 0.5);
    }), 0, 0);

    // Waveform, averaged into a clean line and kept at a steady size.
    const n = GLITCH_N, wave = a.wave, win = 12;
    let pk = 0;
    for (let i = 0; i < n; i++) {
      const j = Math.floor((i / (n - 1)) * (wave.length - win));
      let sum = 0;
      for (let q = 0; q < win; q++) sum += wave[j + q];
      st.raw[i] = sum / win;
      pk = Math.max(pk, Math.abs(st.raw[i]));
    }
    st.peak = pk > st.peak ? pk : lerp(st.peak, pk, 0.03);
    const norm = 1 / Math.max(0.12, st.peak);
    for (let i = 0; i < n; i++) st.wave[i] = lerp(st.wave[i], st.raw[i] * norm, 0.55);
    const cy = h * (f.portrait ? 0.69 : 0.665);
    const amp = s * 0.075 * (0.7 + a.level * 0.4 + a.kick * 0.4);
    const line = (dx) => {
      for (let i = 0; i < n; i++) {
        const taper = Math.pow(Math.sin(Math.PI * i / (n - 1)), 1.2);
        st.pts[i][0] = w * 0.06 + (i / (n - 1)) * w * 0.88 + dx;
        st.pts[i][1] = cy + st.wave[i] * amp * taper;
      }
      ctx.beginPath();
      smoothLine(ctx, st.pts);
    };
    const lw = Math.max(2, s * 0.005);
    const sd = s * (0.002 + 0.008 * g);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lw;
    ctx.globalCompositeOperation = 'lighter';
    line(-sd);
    ctx.strokeStyle = 'rgba(255,40,80,0.85)';
    ctx.stroke();
    line(sd);
    ctx.strokeStyle = 'rgba(0,220,255,0.85)';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    line(0);
    withGlow(ctx, 'rgba(255,255,255,0.6)', s * 0.015, () => {
      ctx.lineWidth = lw * 0.6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });
  },
};

export default [trapRing, bassPunch, chrome, smoke, spotlight, shockwave, glitch];
