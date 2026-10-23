// Calm & sad looks: love songs, sad songs, lo-fi and slow ballads.
// Soft colours and slow movement that still follows the music.
import {
  TAU, clamp, lerp, rgba, shade, mix, mirrored, smoothLine, rng, noise1,
  drawCover, fadeEdge, vignette, roundRect,
  withGlow, slowZoom, formatTime, hexToRgb,
} from '../helpers.js';
import { fontCss } from '../fonts.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Soft round glow, drawn with drawImage so it is cheap at 1080p.
function glowSprite(size = 64, rgb = '255,255,255', core = 0.25) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(core, `rgba(${rgb},0.45)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

// Paint a colour over a canvas with a blend mode.
function tint(g, w, h, color, mode = 'source-over', alpha = 1) {
  g.save();
  g.globalCompositeOperation = mode;
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  g.restore();
}

// Colour-graded copy of the photo, made once (and again if the photo changes).
// Blend modes are slow on a full 1080p frame, so they are baked in here.
function graded(st, f, kind, paint) {
  const src = f.photo[kind] || f.photo.sharp;
  if (st.gradeSrc !== src) {
    const c = makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    paint(g, c.width, c.height);
    st.gradeSrc = src;
    st.grade = c;
  }
  return st.grade;
}

// Photo filling the frame with the slow drift.
function backdrop(ctx, f, img, amount = 0.08) {
  const z = slowZoom(f, amount);
  drawCover(ctx, img, 0, 0, f.w, f.h, z.zoom, z.fx, z.fy);
}

// Frame-size layer for the parts that never move (vignette, edge fades),
// drawn once per video size and then pasted each frame.
function still(st, f, paint) {
  if (!st.still || st.still.width !== f.w || st.still.height !== f.h) {
    st.still = makeCanvas(f.w, f.h);
    paint(st.still.getContext('2d'));
  }
  return st.still;
}

// Film grain from a tile with the noise baked into its alpha: much cheaper
// than an overlay blend at 1080p.
const grainTiles = {};
function filmGrain(ctx, f, amount) {
  let tile = grainTiles[amount];
  if (!tile) {
    tile = makeCanvas(256, 256);
    const g = tile.getContext('2d');
    const d = g.createImageData(256, 256);
    const r = rng(3);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = r() < 0.5 ? 0 : 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = r() * amount * 255;
    }
    g.putImageData(d, 0, 0);
    grainTiles[amount] = tile;
  }
  const k = Math.floor(f.t * 24);
  const ox = (k * 73) % 256, oy = (k * 151) % 256;
  ctx.save();
  ctx.translate(-ox, -oy);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, f.w + 256, f.h + 256);
  ctx.restore();
}

// Fast rise, slow fall: things jump with the music and settle gently.
const follow = (cur, target, up = 0.45, down = 0.06) => lerp(cur, target, target > cur ? up : down);

// Smooth the spectrum into n values with a fast attack and slow release.
function flow(st, key, f, n, up = 0.5, down = 0.08) {
  if (!st[key]) st[key] = new Float32Array(n);
  const arr = st[key];
  const m = mirrored(f.a.bands, n);
  for (let i = 0; i < n; i++) arr[i] = follow(arr[i], m[i], up, down);
  return arr;
}

// Soft light (leaks, haze) painted with normal blending: an additive blend
// over big areas is several times slower on phones without a fast GPU path.
function lightLayer(ctx, st, f, paint) {
  ctx.save();
  paint(ctx);
  ctx.restore();
}

// A line with a soft glow made of wide faint strokes under the real one.
// Much cheaper than shadowBlur on a line that spans the whole frame.
function glowStroke(ctx, pts, core, glow, width) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  smoothLine(ctx, pts);
  ctx.strokeStyle = glow;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = width * 7;
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = core;
  ctx.lineWidth = width;
  ctx.stroke();
}

// ---------- Lo-fi ----------
const lofi = {
  id: 'lofi',
  name: 'Lo-fi',
  ne: 'लो-फाइ',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.66, font: 'kalam', size: 0.09 }, sub: { y: 0.705, font: 'kalam', size: 0.045, opacity: 0.92 } }
    : { title: { y: 0.6, font: 'kalam', size: 0.085 }, sub: { y: 0.69, font: 'kalam', size: 0.042, opacity: 0.92 } }),
  setup() {
    const r = rng(11);
    const dust = [];
    for (let i = 0; i < 40; i++) dust.push({ x: r(), y: r(), z: 0.4 + r() * 0.6, ph: r() * TAU });
    return {
      dust, eq: [0, 0, 0], glow: 0,
      leak: glowSprite(128, '255,170,120', 0.3),
      leak2: glowSprite(128, '255,140,170', 0.3),
      mote: glowSprite(32, '255,240,220', 0.3),
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    // warm peach film tone: lifted, soft shadows instead of grey mud
    backdrop(ctx, f, graded(st, f, 'sharp', (g, gw, gh) => {
      tint(g, gw, gh, '#ff9a5a', 'soft-light', 0.45);
      tint(g, gw, gh, '#3c1e1c', 'screen', 0.32);
      tint(g, gw, gh, '#ff9e7a', 'source-over', 0.1);
      tint(g, gw, gh, '#ffc9a0', 'soft-light', 0.3);
    }), 0.1);

    // two soft light leaks drifting slowly, a little brighter in loud parts
    st.glow = follow(st.glow, a.level * 0.6 + a.bass * 0.4, 0.3, 0.04);
    lightLayer(ctx, st, f, (g) => {
      const lr = s * 0.75;
      g.globalAlpha = 0.16 + st.glow * 0.14 + a.energy * 0.08;
      g.drawImage(st.leak, w * (0.88 + 0.08 * Math.sin(f.t * 0.05)) - lr, h * (0.05 + 0.08 * Math.cos(f.t * 0.04)) - lr, lr * 2, lr * 2);
      g.globalAlpha = 0.1 + st.glow * 0.1;
      const lr2 = s * 0.6;
      g.drawImage(st.leak2, w * (0.06 + 0.05 * Math.cos(f.t * 0.06)) - lr2, h * (0.55 + 0.15 * Math.sin(f.t * 0.035)) - lr2, lr2 * 2, lr2 * 2);
      // soft glow under the little wave
      const gw = w * (f.portrait ? 0.4 : 0.24), gh = s * 0.09;
      g.globalAlpha = 0.12 + st.glow * 0.18;
      g.drawImage(st.leak, w / 2 - gw, h * (f.portrait ? 0.79 : 0.82) - gh, gw * 2, gh * 2);
    });

    // warm edge fade and vignette, painted once
    ctx.drawImage(still(st, f, (g) => {
      fadeEdge(g, f, 'bottom', 0.55, 0.6, '#2a130c');
      const v = g.createRadialGradient(w / 2, h * 0.45, s * 0.35, w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
      v.addColorStop(0, 'rgba(40,16,12,0)');
      v.addColorStop(1, 'rgba(40,16,12,0.5)');
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
    }), 0, 0);

    // dust motes floating in the light, sparkling with the high notes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of st.dust) {
      d.x += f.dt * 0.008 * d.z;
      d.y -= f.dt * 0.005 * d.z;
      if (d.x > 1.02) d.x -= 1.04;
      if (d.y < -0.02) d.y += 1.04;
      ctx.globalAlpha = clamp((0.25 + 0.25 * Math.sin(f.t * 0.8 + d.ph)) * d.z + a.high * 0.3);
      const rr = s * 0.009 * d.z;
      ctx.drawImage(st.mote, d.x * w - rr, d.y * h - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    // small wave of soft rounded bars with a faint reflection, rolling gently
    const n = 31;
    const v = flow(st, 'wave', f, n, 0.55, 0.09);
    const bw = w * (f.portrait ? 0.66 : 0.36);
    const x0 = (w - bw) / 2, step = bw / (n - 1);
    const cy = h * (f.portrait ? 0.8 : 0.835);
    const maxH = s * (f.portrait ? 0.075 : 0.08) * (1 + a.kick * 0.06);
    const peach = mix(f.color.accent, '#ffc6a0', 0.6);
    const bar = step * 0.55;
    const tops = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const taper = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * u), 0.7);
      const roll = 0.8 + 0.2 * Math.sin(u * 12 - f.t * 2.4);
      tops.push(Math.max(bar, maxH * v[i] * taper * roll));
    }
    // reflection under the line
    ctx.fillStyle = rgba(peach, 0.22);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const hh = tops[i] * 0.35;
      roundRect(ctx, x0 + i * step - bar / 2, cy + s * 0.008, bar, Math.max(bar, hh), bar / 2);
      ctx.fill();
    }
    const grad = ctx.createLinearGradient(0, cy - maxH, 0, cy);
    grad.addColorStop(0, '#fff6ea');
    grad.addColorStop(1, shade(peach, 0.1));
    {
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = x0 + i * step - bar / 2;
        ctx.moveTo(x, cy - tops[i] + bar / 2);
        ctx.arc(x + bar / 2, cy - tops[i] + bar / 2, bar / 2, -Math.PI, 0);
        ctx.lineTo(x + bar, cy);
        ctx.lineTo(x, cy);
        ctx.closePath();
      }
      ctx.fill();
    }

    // progress line with times, like a little music player
    const py = cy + s * 0.08;
    const lw = Math.max(1.5, s * 0.004);
    ctx.lineCap = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(255,240,226,0.3)';
    ctx.beginPath();
    ctx.moveTo(x0, py);
    ctx.lineTo(x0 + bw, py);
    ctx.stroke();
    const px = x0 + bw * clamp(f.progress);
    ctx.strokeStyle = 'rgba(255,240,226,0.9)';
    ctx.beginPath();
    ctx.moveTo(x0, py);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = '#fff2e4';
    ctx.beginPath();
    ctx.arc(px, py, lw * 2.2, 0, TAU);
    ctx.fill();
    ctx.font = fontCss('mukta', s * 0.026, 500);
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.85;
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(f.t), x0 - s * 0.025, py);
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(f.dur), x0 + bw + s * 0.025, py);
    ctx.globalAlpha = 1;

    // "now playing" pill with a tiny moving equaliser
    const fs = s * 0.03;
    ctx.font = fontCss('kalam', fs);
    const label = 'now playing';
    const tw = ctx.measureText(label).width;
    const ph = fs * 1.75, icon = fs * 1.05;
    const pw = tw + icon + fs * 1.9;
    const bx = s * 0.05, by = s * 0.05;
    roundRect(ctx, bx, by, pw, ph, ph / 2);
    ctx.fillStyle = 'rgba(46,22,16,0.38)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.strokeStyle = 'rgba(255,236,220,0.45)';
    ctx.stroke();
    const lv = [a.bass, a.mid * 1.3, a.high * 2];
    const ew = icon / 4.2;
    ctx.fillStyle = shade(peach, 0.2);
    for (let i = 0; i < 3; i++) {
      st.eq[i] = follow(st.eq[i], clamp(lv[i]), 0.5, 0.15);
      const eh = ph * (0.18 + 0.45 * st.eq[i]);
      roundRect(ctx, bx + fs * 0.75 + i * ew * 1.6, by + ph / 2 + ph * 0.3 - eh, ew, eh, ew / 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3e6';
    ctx.textAlign = 'left';
    ctx.fillText(label, bx + fs * 1.1 + icon, by + ph / 2 + fs * 0.06);

    filmGrain(ctx, f, 0.035);
  },
};

// ---------- Rain ----------
function dropSprite(size = 64) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  // body: clear middle, light pooled at the bottom, dark rim at the top
  const body = g.createRadialGradient(r, r * 1.25, r * 0.1, r, r, r);
  body.addColorStop(0, 'rgba(235,245,255,0.55)');
  body.addColorStop(0.55, 'rgba(190,215,245,0.18)');
  body.addColorStop(0.85, 'rgba(10,20,40,0.35)');
  body.addColorStop(1, 'rgba(10,20,40,0)');
  g.fillStyle = body;
  g.beginPath();
  g.arc(r, r, r, 0, TAU);
  g.fill();
  // bright highlight near the top
  const hl = g.createRadialGradient(r * 0.75, r * 0.6, 0, r * 0.75, r * 0.6, r * 0.32);
  hl.addColorStop(0, 'rgba(255,255,255,0.95)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.fillRect(0, 0, size, size);
  return c;
}

const rain = {
  id: 'rain',
  name: 'Rain',
  ne: 'झरी',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.6, font: 'martel', size: 0.08 }, sub: { y: 0.645, font: 'mukta', size: 0.04 } }
    : { title: { y: 0.6, font: 'martel', size: 0.08 }, sub: { y: 0.685, font: 'mukta', size: 0.038 } }),
  setup() {
    const r = rng(5);
    const drops = [];
    for (let i = 0; i < 150; i++) {
      drops.push({ x: r(), y: r(), rad: 0.003 + Math.pow(r(), 2.4) * 0.016, life: r() * 10, age: 3 });
    }
    const sliders = [];
    for (let i = 0; i < 26; i++) sliders.push({ on: false, x: 0, y: 0, y0: 0, rad: 0, sp: 0, seed: i, bead: 0 });
    const streaks = [];
    for (let i = 0; i < 110; i++) streaks.push({ x: r(), y: r(), len: 0.04 + r() * 0.07, sp: 1.2 + r() * 1.2 });
    return { r, drops, sliders, streaks, sprite: dropSprite(), spawn: 0, slide: 0.5, nd: 0, wave: new Float32Array(72) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    const r = st.r;
    backdrop(ctx, f, graded(st, f, 'blur', (g, gw, gh) => {
      tint(g, gw, gh, '#000000', 'source-over', 0.15);
      tint(g, gw, gh, '#2d5ea0', 'color', 0.6);
      tint(g, gw, gh, '#0d1b33', 'multiply', 0.35);
    }), 0.12);
    ctx.drawImage(still(st, f, (g) => {
      fadeEdge(g, f, 'bottom', 0.5, 0.55, '#050b18');
      vignette(g, f, 0.45);
      g.fillStyle = 'rgba(200,220,255,0.05)'; // thin misty glass
      g.fillRect(0, 0, w, h);
    }), 0, 0);

    // rain falling outside, heavier when the music is louder
    const loud = clamp(a.level * 0.7 + a.energy * 0.6);
    const active = Math.round(st.streaks.length * (0.3 + 0.7 * loud));
    ctx.strokeStyle = 'rgba(210,228,255,0.22)';
    ctx.lineWidth = Math.max(1, s * 0.0016);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < st.streaks.length; i++) {
      const k = st.streaks[i];
      k.y += f.dt * k.sp * (0.8 + loud * 0.6);
      k.x += f.dt * k.sp * 0.08;
      if (k.y > 1.1) { k.y -= 1.2; k.x = r(); }
      if (k.x > 1) k.x -= 1;
      if (i >= active) continue;
      const x = k.x * w, y = k.y * h, l = k.len * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x - l * 0.08, y - l);
    }
    ctx.stroke();

    // new drops land on the glass, more when it is loud
    st.spawn += f.dt * (5 + loud * 45 + a.kick * 10);
    while (st.spawn >= 1) {
      st.spawn -= 1;
      const d = st.drops[st.nd];
      st.nd = (st.nd + 1) % st.drops.length;
      d.x = r(); d.y = r(); d.rad = 0.003 + Math.pow(r(), 2.4) * 0.016; d.life = 6 + r() * 8; d.age = 0;
    }
    // now and then a drop gets heavy and slides down
    st.slide += f.dt * (0.5 + loud * 2.5);
    if (st.slide >= 1) {
      st.slide -= 1;
      const sl = st.sliders.find((q) => !q.on);
      if (sl) {
        sl.on = true; sl.x = 0.04 + r() * 0.92; sl.y = r() * 0.5; sl.y0 = sl.y;
        sl.rad = 0.014 + r() * 0.01; sl.sp = 0.05 + r() * 0.08; sl.bead = 0;
      }
    }

    const spr = st.sprite;
    for (const d of st.drops) {
      d.age += f.dt;
      const al = clamp(d.age * 4) * clamp((d.life - d.age) / 2);
      if (al <= 0) continue;
      const rr = d.rad * s;
      ctx.globalAlpha = al;
      ctx.drawImage(spr, d.x * w - rr, d.y * h - rr, rr * 2, rr * 2);
    }
    ctx.globalAlpha = 1;

    for (const sl of st.sliders) {
      if (!sl.on) continue;
      // stop-and-go speed, like a real drop on glass
      const go = clamp(0.15 + noise1(f.t * 1.6 + sl.seed * 7.3, sl.seed));
      const dy = f.dt * sl.sp * go * 2.2 * (1 + a.kick * 0.4);
      sl.y += dy;
      sl.x += noise1(f.t * 2 + sl.seed, 3) * dy * 0.12 * (h / w);
      sl.bead += dy;
      if (sl.bead > 0.03) {
        // leave a tiny bead behind
        sl.bead = 0;
        const d = st.drops[st.nd];
        st.nd = (st.nd + 1) % st.drops.length;
        d.x = sl.x; d.y = sl.y - sl.rad * 1.5 * s / h; d.rad = sl.rad * 0.3; d.life = 4 + r() * 3; d.age = 0.2;
      }
      // swallow drops in the way
      for (const d of st.drops) {
        if (d.age < d.life && Math.abs(d.x - sl.x) * w < sl.rad * s && d.y < sl.y && d.y > sl.y - 0.02) d.age = d.life;
      }
      if (sl.y > 1.08) { sl.on = false; continue; }
      const x = sl.x * w, y = sl.y * h, rr = sl.rad * s;
      const tg = ctx.createLinearGradient(0, sl.y0 * h, 0, y);
      tg.addColorStop(0, 'rgba(210,228,255,0)');
      tg.addColorStop(1, 'rgba(215,232,255,0.42)');
      ctx.strokeStyle = tg;
      ctx.lineWidth = rr * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, sl.y0 * h);
      ctx.lineTo(x, y - rr * 0.5);
      ctx.stroke();
      ctx.drawImage(spr, x - rr, y - rr * 1.25, rr * 2, rr * 2.4);
    }

    // a thin soft wave low on the glass
    const n = st.wave.length;
    const m = mirrored(a.bands, n);
    const cy = h * (f.portrait ? 0.8 : 0.84);
    const amp = s * 0.07;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const taper = Math.sin(Math.PI * x);
      st.wave[i] = lerp(st.wave[i], m[i] * Math.sin(i * 0.7 - f.t * 2.2), 0.35);
      pts.push([x * w, cy + st.wave[i] * amp * taper]);
    }
    withGlow(ctx, 'rgba(160,200,255,0.9)', s * 0.02, () => {
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineWidth = Math.max(1.2, s * 0.003);
      ctx.strokeStyle = 'rgba(225,238,255,0.8)';
      ctx.stroke();
    });
    filmGrain(ctx, f, 0.06);
  },
};

// ---------- Night Stars ----------
const nightStars = {
  id: 'night-stars',
  name: 'Night Stars',
  ne: 'तारा भरिएको रात',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.66, font: 'martel', size: 0.085, style: 'glow' }, sub: { y: 0.705, font: 'mukta', size: 0.04 } }
    : { title: { y: 0.7, font: 'martel', size: 0.08, style: 'glow' }, sub: { y: 0.785, font: 'mukta', size: 0.038 } }),
  setup() {
    const r = rng(42);
    const stars = [];
    for (let i = 0; i < 210; i++) {
      const big = i < 16;
      stars.push({
        x: r(), y: Math.pow(r(), 1.5) * 0.9,
        size: big ? 0.0035 + r() * 0.002 : 0.0007 + Math.pow(r(), 3) * 0.0028,
        ph: r() * TAU, sp: 0.5 + r() * 2.2, b: 34 + Math.floor(r() * 28), big,
        col: r() < 0.2 ? '#ffe7c2' : r() < 0.4 ? '#cfe0ff' : '#ffffff',
      });
    }
    return { r, stars, glow: glowSprite(), shot: null, last: -10, halo: 0 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    backdrop(ctx, f, graded(st, f, 'sharp', (g, gw, gh) => {
      tint(g, gw, gh, '#000000', 'source-over', 0.15);
      tint(g, gw, gh, '#22356e', 'color', 0.55);
      tint(g, gw, gh, '#6676b4', 'multiply');
    }), 0.06);
    ctx.drawImage(still(st, f, (g) => {
      fadeEdge(g, f, 'top', 0.65, 0.8, '#040716');
      fadeEdge(g, f, 'bottom', 0.45, 0.6, '#03050f');
      vignette(g, f, 0.4);
    }), 0, 0);

    // moon with a halo that breathes with the bass
    const mx = w * (f.portrait ? 0.7 : 0.8), my = h * (f.portrait ? 0.16 : 0.24);
    const mr = s * (f.portrait ? 0.1 : 0.075);
    st.halo = lerp(st.halo, a.bass * 0.6 + a.level * 0.4, 0.12);
    const hr = mr * (3.2 + st.halo * 1.6);
    const hg = ctx.createRadialGradient(mx, my, mr * 0.9, mx, my, hr);
    hg.addColorStop(0, `rgba(255,236,200,${0.26 + st.halo * 0.18})`);
    hg.addColorStop(0.35, `rgba(200,210,255,${0.08 + st.halo * 0.06})`);
    hg.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(mx - hr, my - hr, hr * 2, hr * 2);

    // stars twinkle slowly and sparkle with the high notes
    const glow = st.glow;
    for (const p of st.stars) {
      const tw = 0.5 + 0.5 * Math.sin(f.t * p.sp + p.ph);
      const spark = clamp((a.bands[p.b] - 0.22) * 2.6);
      const fade = 1 - 0.85 * clamp((p.y - 0.5) / 0.4);
      const al = clamp((0.25 + 0.45 * tw + spark * 0.6) * fade);
      const x = p.x * w, y = p.y * h;
      if (Math.hypot(x - mx, y - my) < mr * 1.15) continue;
      const rr = p.size * s * (1 + spark * 0.5);
      ctx.globalAlpha = al;
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
      if (p.big) {
        const g = rr * (5 + spark * 4);
        ctx.globalAlpha = al * 0.7;
        ctx.drawImage(glow, x - g, y - g, g * 2, g * 2);
        const l = s * (0.008 + 0.028 * spark + 0.004 * tw);
        ctx.globalAlpha = al * 0.8;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = Math.max(1, s * 0.0014);
        ctx.beginPath();
        ctx.moveTo(x - l, y); ctx.lineTo(x + l, y);
        ctx.moveTo(x, y - l); ctx.lineTo(x, y + l);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // moon disc
    withGlow(ctx, 'rgba(255,240,210,0.9)', s * 0.06, () => {
      const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#fffaf0');
      mg.addColorStop(1, '#e6d8b4');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, mr * (1 + a.bass * 0.015), 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(170,150,115,0.22)';
    for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.17], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.09], [-0.4, 0.25, 0.08]]) {
      ctx.beginPath();
      ctx.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, TAU);
      ctx.fill();
    }

    // a shooting star on some strong beats (never more than one at a time)
    if (!st.shot && a.beatHit && a.kick > 0.5 && a.bass > 0.4 && f.t - st.last > 2.5) {
      st.last = f.t;
      if (st.r() < 0.6) {
        const dir = st.r() < 0.5 ? 1 : -1;
        const ang = (0.42 + st.r() * 0.25);
        st.shot = {
          x: w * (dir > 0 ? 0.08 + st.r() * 0.45 : 0.47 + st.r() * 0.45), y: h * (0.04 + st.r() * 0.22),
          vx: Math.cos(ang) * dir, vy: Math.sin(ang), age: 0, dur: 1.1,
        };
      }
    }
    if (st.shot) {
      const sh = st.shot;
      sh.age += f.dt;
      const p = sh.age / sh.dur;
      if (p >= 1) st.shot = null;
      else {
        const dist = s * 0.75 * p;
        const hx = sh.x + sh.vx * dist, hy = sh.y + sh.vy * dist;
        const tl = s * 0.28 * Math.sin(Math.PI * Math.min(1, p * 1.4));
        const tx = hx - sh.vx * tl, ty = hy - sh.vy * tl;
        const al = Math.sin(Math.PI * p);
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, `rgba(255,255,255,${0.95 * al})`);
        ctx.strokeStyle = g;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.5, s * 0.004);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        const gr = s * 0.025;
        ctx.globalAlpha = al;
        ctx.drawImage(glow, hx - gr, hy - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;
      }
    }
  },
};

// ---------- Bokeh Lights ----------
function bokehSprite(color, size = 128) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(color, 0.42));
  gr.addColorStop(0.72, rgba(color, 0.5));
  gr.addColorStop(0.88, rgba(shade(color, 0.25), 0.78));
  gr.addColorStop(0.95, rgba(color, 0.3));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

const bokeh = {
  id: 'bokeh',
  name: 'Bokeh Lights',
  ne: 'बत्तीहरू',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.47, font: 'rozha', size: 0.1, style: 'glow' }, sub: { y: 0.52, font: 'mukta', size: 0.042 } }
    : { title: { y: 0.46, font: 'rozha', size: 0.095, style: 'glow' }, sub: { y: 0.56, font: 'mukta', size: 0.04 } }),
  setup() {
    const r = rng(23);
    const dots = [];
    for (let i = 0; i < 44; i++) {
      const layer = i < 18 ? 0 : i < 34 ? 1 : 2;
      const size = [[0.012, 0.014], [0.03, 0.028], [0.07, 0.05]][layer];
      dots.push({
        x: r(), y: r(), layer, rad: size[0] + r() * size[1],
        ci: Math.floor(r() * 5), b: Math.floor(r() * 48), ph: r() * 50, v: 0,
      });
    }
    return { dots, sprites: {}, warm: glowSprite(128, '255,190,170', 0.4) };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    backdrop(ctx, f, graded(st, f, 'blur', (g, gw, gh) => {
      tint(g, gw, gh, '#000000', 'source-over', 0.5);
      tint(g, gw, gh, '#ff6f93', 'soft-light', 0.55);
    }), 0.12);
    ctx.drawImage(still(st, f, (g) => vignette(g, f, 0.6)), 0, 0);

    const cols = [f.color.accent, f.color.accent2, '#ffd59a', '#ff9fb6', '#fff1e0'];
    const sprite = (c) => st.sprites[c] || (st.sprites[c] = bokehSprite(c));
    const lift = [0.006, 0.011, 0.018];
    const base = [0.7, 0.5, 0.32];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const d of st.dots) {
      d.v = lerp(d.v, a.bands[d.b], 0.12);
      d.y -= f.dt * lift[d.layer] * (1 + a.energy * 0.8);
      d.x += noise1(f.t * 0.12 + d.ph, d.layer) * f.dt * 0.012;
      const m = d.rad * s / Math.min(w, h) + 0.1;
      if (d.y < -m) d.y += 1 + m * 2;
      if (d.x < -m) d.x += 1 + m * 2;
      if (d.x > 1 + m) d.x -= 1 + m * 2;
      const rr = d.rad * s * (1 + 0.5 * d.v + (d.layer === 2 ? 0.08 : 0.04) * a.beat);
      ctx.globalAlpha = clamp(base[d.layer] * (0.45 + 1.1 * d.v));
      ctx.drawImage(sprite(cols[d.ci]), d.x * w - rr, d.y * h - rr, rr * 2, rr * 2);
    }
    ctx.restore();

    // warm glow behind the words, swelling softly with the music
    const cx = w / 2, cy = h * 0.5;
    const gr = s * (0.5 + a.level * 0.12);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1 + a.beat * 0.05;
    ctx.drawImage(st.warm, cx - gr, cy - gr, gr * 2, gr * 2);
    ctx.restore();
    filmGrain(ctx, f, 0.05);
  },
};

// ---------- Polaroid ----------
// Where the polaroid sits. Shared by text() and draw() so the words land on it.
function polaroidBox(f) {
  const { w, h } = f;
  const ratio = 0.83; // frame width / height
  let fh, cy;
  if (f.portrait) {
    fh = Math.min(0.8 * w, 0.42 * h) / ratio;
    cy = h * 0.4;
  } else {
    fh = Math.min(0.8 * h, (0.86 * w) / ratio);
    cy = h * 0.46;
  }
  const fw = fh * ratio, m = fw * 0.06, side = fw - m * 2, strip = fh - m - side;
  return { cx: w / 2, cy, fw, fh, m, side, strip, top: cy - fh / 2, bottom: cy + fh / 2, stripY: cy + fh / 2 - strip / 2 };
}

const polaroid = {
  id: 'polaroid',
  name: 'Polaroid',
  ne: 'पोलारोइड',
  cat: 'calm',
  text(f) {
    const b = polaroidBox(f);
    const ink = { font: 'kalam', color: '#2c2724', style: 'plain' };
    if (f.portrait) {
      return {
        title: { ...ink, y: b.stripY / f.h, size: Math.min(0.08, (b.strip / f.s) * 0.42) },
        sub: { font: 'kalam', y: (b.bottom + f.h * 0.05) / f.h, size: 0.045 },
      };
    }
    return {
      title: { ...ink, y: (b.stripY - b.strip * 0.13) / f.h, size: (b.strip / f.s) * 0.36 },
      sub: { ...ink, y: (b.stripY + b.strip * 0.28) / f.h, size: (b.strip / f.s) * 0.18, opacity: 0.75 },
    };
  },
  setup() {
    const r = rng(9);
    const jit = new Float32Array(40);
    for (let i = 0; i < jit.length; i++) jit[i] = r() * 2 - 1;
    // soft shadow drawn once, small, then stretched under the frame
    const shadow = makeCanvas(124, 146);
    const g = shadow.getContext('2d');
    g.shadowColor = '#000000';
    g.shadowBlur = 9;
    g.fillStyle = '#000000';
    g.fillRect(12, 12, 100, 122);
    return { jit, wave: new Float32Array(40), sway: 0, shadow };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    backdrop(ctx, f, graded(st, f, 'blur', (g, gw, gh) => {
      tint(g, gw, gh, '#000000', 'source-over', 0.3);
      tint(g, gw, gh, '#ffb27a', 'soft-light', 0.4);
    }), 0.14);
    ctx.drawImage(still(st, f, (g) => vignette(g, f, 0.55)), 0, 0);

    const b = polaroidBox(f);
    // gentle sway that grows a little in louder parts
    st.sway = lerp(st.sway, a.energy, 0.05);
    const ang = -0.04 + (0.012 + 0.02 * st.sway) * Math.sin(f.t * 0.9) + 0.006 * a.beat;
    const sc = 1 + a.kick * 0.006;
    ctx.save();
    ctx.translate(b.cx, b.stripY);
    ctx.rotate(ang);
    ctx.scale(sc, sc);
    ctx.translate(-b.cx, -b.stripY);
    const left = b.cx - b.fw / 2;

    // paper with a soft drop shadow
    const pad = b.fw * 0.12;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(st.shadow, left - pad, b.top - pad + s * 0.014, b.fw + pad * 2, b.fh + pad * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f5f1e8';
    roundRect(ctx, left, b.top, b.fw, b.fh, s * 0.005);
    ctx.fill();
    const pg = ctx.createLinearGradient(0, b.top, 0, b.bottom);
    pg.addColorStop(0, 'rgba(255,255,255,0.5)');
    pg.addColorStop(1, 'rgba(210,200,180,0.25)');
    ctx.fillStyle = pg;
    roundRect(ctx, left, b.top, b.fw, b.fh, s * 0.005);
    ctx.fill();

    // the photo, slightly faded like an old print
    const ix = left + b.m, iy = b.top + b.m;
    const z = slowZoom(f, 0.06);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, b.side, b.side);
    ctx.clip();
    drawCover(ctx, f.photo.sharp, ix, iy, b.side, b.side, z.zoom, z.fx, z.fy);
    ctx.fillStyle = 'rgba(255,215,170,0.12)';
    ctx.fillRect(ix, iy, b.side, b.side);
    ctx.restore();
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.strokeRect(ix, iy, b.side, b.side);

    // a strip of tape holding it up
    ctx.save();
    ctx.translate(b.cx, b.top);
    ctx.rotate(0.06);
    ctx.fillStyle = 'rgba(255,252,238,0.78)';
    ctx.fillRect(-b.fw * 0.15, -b.fh * 0.03, b.fw * 0.3, b.fh * 0.06);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-b.fw * 0.15, -b.fh * 0.03, b.fw * 0.3, b.fh * 0.015);
    ctx.restore();
    ctx.restore();

    // small hand-drawn wave line under the polaroid, ending in a heart
    const n = st.wave.length;
    const ww = f.portrait ? w * 0.5 : b.fw * 0.62;
    const x0 = b.cx - ww / 2;
    const cy = f.portrait ? b.bottom + h * 0.115 : b.bottom + (h - b.bottom) * 0.5;
    const amp = s * (f.portrait ? 0.045 : 0.032);
    const m = mirrored(a.bands, n);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const taper = Math.sin(Math.PI * x);
      const target = Math.sin(i * 0.8 - f.t * 2.4) * (0.2 + m[i]) * taper;
      st.wave[i] = lerp(st.wave[i], target, 0.3);
      pts.push([x0 + x * ww, cy + (st.wave[i] + st.jit[i] * 0.06) * amp]);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,248,236,0.92)';
    ctx.lineWidth = Math.max(1.5, s * 0.0045);
    ctx.beginPath();
    smoothLine(ctx, pts);
    ctx.stroke();
    // second thinner pass, a little off, like a pen line
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    smoothLine(ctx, pts.map(([x, y], i) => [x, y + st.jit[(i + 7) % n] * s * 0.003]));
    ctx.stroke();
    ctx.globalAlpha = 1;
    const hs = s * (0.016 + a.beat * 0.003);
    const hx = x0 + ww + s * 0.03, hy = cy;
    ctx.fillStyle = shade(f.color.accent, 0.2);
    ctx.beginPath();
    ctx.moveTo(hx, hy + hs * 0.8);
    ctx.bezierCurveTo(hx - hs * 1.3, hy - hs * 0.1, hx - hs * 0.6, hy - hs * 1.1, hx, hy - hs * 0.35);
    ctx.bezierCurveTo(hx + hs * 0.6, hy - hs * 1.1, hx + hs * 1.3, hy - hs * 0.1, hx, hy + hs * 0.8);
    ctx.fill();
    filmGrain(ctx, f, 0.05);
  },
};

// ---------- Golden Hour ----------
// Soft ring for the little lens-flare ghosts.
function ringSprite(size = 128, rgb = '255,220,170') {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},0.12)`);
  gr.addColorStop(0.7, `rgba(${rgb},0.22)`);
  gr.addColorStop(0.86, `rgba(${rgb},0.55)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

const goldenHour = {
  id: 'golden-hour',
  name: 'Golden Hour',
  ne: 'साँझको घाम',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.62, font: 'rozha', size: 0.1 }, sub: { y: 0.665, font: 'mukta', size: 0.042 } }
    : { title: { y: 0.6, font: 'rozha', size: 0.092 }, sub: { y: 0.69, font: 'mukta', size: 0.04 } }),
  setup() {
    return {
      sun: 0, warm: 0,
      haze: glowSprite(256, '255,190,110', 0.15),
      core: glowSprite(128, '255,246,225', 0.2),
      leak: glowSprite(128, '255,140,60', 0.35),
      leak2: glowSprite(128, '255,110,120', 0.35),
      ring: ringSprite(128, '255,214,160'),
      disc: glowSprite(64, '255,200,140', 0.5),
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    // warm golden grade with honey-coloured shadows
    backdrop(ctx, f, graded(st, f, 'sharp', (g, gw, gh) => {
      tint(g, gw, gh, '#ff9d3a', 'soft-light', 0.5);
      tint(g, gw, gh, '#3a1c0c', 'screen', 0.35);
      tint(g, gw, gh, '#ff9a48', 'source-over', 0.14);
      tint(g, gw, gh, '#ffe2b0', 'soft-light', 0.25);
    }), 0.1);
    ctx.drawImage(still(st, f, (g) => {
      fadeEdge(g, f, 'bottom', 0.5, 0.7, '#2a1206');
      vignette(g, f, 0.35);
    }), 0, 0);

    st.sun = follow(st.sun, a.bass * 0.55 + a.level * 0.45, 0.35, 0.04);
    st.warm = follow(st.warm, a.energy, 0.05, 0.02);
    const sx = w * (f.portrait ? 0.74 : 0.8) + s * 0.05 * Math.sin(f.t * 0.05);
    const sy = h * (f.portrait ? 0.13 : 0.17) + s * 0.03 * Math.cos(f.t * 0.04);

    // light leaks drifting in from the side and the corner, and the sun haze
    lightLayer(ctx, st, f, (g) => {
      const l1 = s * 0.85;
      g.globalAlpha = 0.14 + st.warm * 0.18 + st.sun * 0.06;
      g.drawImage(st.leak, w * (0.02 + 0.05 * Math.sin(f.t * 0.06)) - l1, h * (0.3 + 0.2 * Math.sin(f.t * 0.04)) - l1, l1 * 2, l1 * 2);
      const l2 = s * 0.55;
      g.globalAlpha = 0.1 + st.warm * 0.12;
      g.drawImage(st.leak2, w * (0.98 - 0.04 * Math.cos(f.t * 0.05)) - l2, h * (0.75 + 0.1 * Math.sin(f.t * 0.03)) - l2, l2 * 2, l2 * 2);
      const hr = s * (0.75 + st.sun * 0.2);
      g.globalAlpha = 0.3 + st.sun * 0.25;
      g.drawImage(st.haze, sx - hr, sy - hr, hr * 2, hr * 2);
    });

    // the bright sun core, a thin horizontal streak and the flare ghosts
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cr = s * (0.11 + st.sun * 0.03);
    ctx.globalAlpha = 0.75;
    ctx.drawImage(st.core, sx - cr, sy - cr, cr * 2, cr * 2);
    const sw = s * (0.9 + st.sun * 0.4), sh = s * 0.02;
    ctx.globalAlpha = 0.22 + st.sun * 0.25;
    ctx.drawImage(st.core, sx - sw, sy - sh, sw * 2, sh * 2);

    // flare ghosts on the line from the sun through the middle
    const cx = w / 2, cy = h / 2;
    const ghosts = [[0.35, 0.04, st.disc, 0.3], [0.62, 0.08, st.ring, 0.28], [1.5, 0.035, st.disc, 0.3], [1.8, 0.12, st.ring, 0.16]];
    for (const [k, size, img, al] of ghosts) {
      const gx = sx + (cx - sx) * k, gy = sy + (cy - sy) * k;
      const gr = s * size * (1 + st.sun * 0.15);
      ctx.globalAlpha = al * (0.5 + st.sun * 0.7);
      ctx.drawImage(img, gx - gr, gy - gr, gr * 2, gr * 2);
    }
    ctx.restore();

    // soft golden wave rising from the bottom edge
    const n = 60;
    const v = flow(st, 'wave', f, n, 0.5, 0.08);
    const ec = flow(st, 'echo', f, n, 0.1, 0.025);
    const base = h - s * 0.02;
    const amp = s * (f.portrait ? 0.2 : 0.18) * (1 + a.kick * 0.08);
    const crest = (arr, k, ph) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const roll = 0.85 + 0.15 * Math.sin(u * 9 - f.t * 1.4 + ph);
        pts.push([u * w, base - amp * k * (0.08 + arr[i] * roll) * (0.35 + 0.65 * Math.sin(Math.PI * u))]);
      }
      return pts;
    };
    const fillUnder = (pts, style) => {
      ctx.beginPath();
      smoothLine(ctx, pts);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
    };
    const gold = mix(f.color.accent, '#ffb43c', 0.75);
    fillUnder(crest(ec, 1.3, 2), rgba(gold, 0.22));
    const top = crest(v, 1, 0);
    const fg = ctx.createLinearGradient(0, base - amp * 0.6, 0, h);
    fg.addColorStop(0, rgba(shade(gold, 0.45), 0.3));
    fg.addColorStop(0.55, rgba(shade(gold, 0.15), 0.55));
    fg.addColorStop(1, rgba(gold, 0.75));
    fillUnder(top, fg);
    glowStroke(ctx, top, 'rgba(255,246,226,0.95)', rgba(shade(gold, 0.2), 1), Math.max(1.5, s * 0.004));
  },
};

// ---------- Fireflies ----------
const fireflies = {
  id: 'fireflies',
  name: 'Fireflies',
  ne: 'जुनकिरी',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.3, font: 'martel', size: 0.085, style: 'glow', color: '#fff4dc' }, sub: { y: 0.345, font: 'mukta', size: 0.04 } }
    : { title: { y: 0.36, font: 'martel', size: 0.08, style: 'glow', color: '#fff4dc' }, sub: { y: 0.445, font: 'mukta', size: 0.038 } }),
  setup() {
    const r = rng(17);
    const flies = [];
    for (let i = 0; i < 80; i++) {
      const far = i < 50;
      flies.push({
        x: r(), y: 0.5 + Math.pow(r(), 0.8) * 0.46, ph: r() * 50, sp: 0.6 + r() * 1.6,
        size: far ? 0.0022 + r() * 0.002 : 0.004 + r() * 0.003, b: 4 + Math.floor(r() * 54), v: 0,
        far, warm: r() < 0.7,
      });
    }
    return {
      flies,
      glowW: glowSprite(64, '255,214,120', 0.15),
      glowG: glowSprite(64, '214,255,140', 0.15),
      core: glowSprite(32, '255,252,230', 0.45),
      ground: 0,
    };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    // evening dusk grade so the lights stand out
    backdrop(ctx, f, graded(st, f, 'sharp', (g, gw, gh) => {
      tint(g, gw, gh, '#000000', 'source-over', 0.22);
      tint(g, gw, gh, '#2c4a70', 'soft-light', 0.45);
      tint(g, gw, gh, '#3a2a40', 'screen', 0.25);
    }), 0.08);
    ctx.drawImage(still(st, f, (g) => {
      fadeEdge(g, f, 'bottom', 0.6, 0.85, '#05080d');
      fadeEdge(g, f, 'top', 0.25, 0.3, '#05080d');
      vignette(g, f, 0.45);
    }), 0, 0);

    // warm glow rising from the ground with the music
    st.ground = follow(st.ground, a.level * 0.7 + a.bass * 0.3, 0.3, 0.04);
    const gy = h * 0.72;
    const gg = ctx.createLinearGradient(0, gy, 0, h);
    gg.addColorStop(0, 'rgba(255,190,90,0)');
    gg.addColorStop(1, `rgba(255,180,80,${0.08 + st.ground * 0.1})`);
    ctx.fillStyle = gg;
    ctx.fillRect(0, gy, w, h - gy);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of st.flies) {
      // wander on a slow, lazy path
      p.x += noise1(f.t * 0.25 + p.ph, 1) * f.dt * 0.02;
      p.y += noise1(f.t * 0.2 + p.ph, 2) * f.dt * 0.012 - f.dt * 0.002;
      if (p.x < -0.03) p.x += 1.06;
      if (p.x > 1.03) p.x -= 1.06;
      if (p.y < 0.48) p.y = 0.48;
      if (p.y > 0.98) p.y = 0.98;
      // each one listens to its own part of the spectrum
      p.v = follow(p.v, clamp((a.bands[p.b] - 0.15) * 1.6), 0.4, 0.05);
      const blink = 0.5 + 0.5 * Math.sin(f.t * p.sp + p.ph);
      const al = clamp(0.12 + 0.35 * blink * blink + p.v * 0.75);
      const x = p.x * w, y = p.y * h;
      const rr = p.size * s * (1 + p.v * 0.6);
      const halo = rr * (p.far ? 4.5 : 6);
      ctx.globalAlpha = al * 0.75;
      ctx.drawImage(p.warm ? st.glowW : st.glowG, x - halo, y - halo, halo * 2, halo * 2);
      ctx.globalAlpha = al;
      ctx.drawImage(st.core, x - rr * 1.6, y - rr * 1.6, rr * 3.2, rr * 3.2);
    }
    ctx.restore();

    // thin wave line near the bottom with a faint reflection below it
    const n = 64;
    const v = flow(st, 'wave', f, n, 0.5, 0.08);
    const cy = h * (f.portrait ? 0.9 : 0.885);
    const amp = s * 0.1;
    const up = [], down = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const taper = Math.pow(Math.sin(Math.PI * u), 1.2);
      const d = (0.03 + v[i] * (0.8 + 0.2 * Math.sin(u * 14 - f.t * 2))) * taper * amp;
      up.push([u * w, cy - d]);
      down.push([u * w, cy + d * 0.4]);
    }
    const lineCol = mix(f.color.accent, '#ffe2a0', 0.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    smoothLine(ctx, down);
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = rgba(lineCol, 0.3);
    ctx.stroke();
    glowStroke(ctx, up, 'rgba(255,248,228,0.95)', rgba(lineCol, 1), Math.max(1.2, s * 0.003));
  },
};

// ---------- Floating Frame ----------
// Where the framed photo sits. Shared by text() and draw().
function frameBox(f) {
  const { w, h, s } = f;
  let fw, fh, cy;
  if (f.portrait) {
    fw = w * 0.8; fh = Math.min(fw * 1.25, h * 0.56); cy = h * 0.39;
  } else if (f.square) {
    fw = fh = s * 0.56; cy = h * 0.37;
  } else {
    fh = h * 0.58; fw = fh * 1.36; cy = h * 0.385;
  }
  const bottom = cy + fh / 2;
  const waveY = bottom + s * (f.portrait ? 0.075 : 0.065);
  return { cx: w / 2, cy, fw, fh, top: cy - fh / 2, bottom, waveY, r: s * 0.03 };
}

const floatingFrame = {
  id: 'frame',
  name: 'Floating Frame',
  ne: 'तैरिने फ्रेम',
  cat: 'calm',
  text(f) {
    const b = frameBox(f);
    const ty = b.waveY + f.s * (f.portrait ? 0.14 : 0.1);
    return {
      title: { y: ty / f.h, font: 'martel', size: f.portrait ? 0.075 : 0.062 },
      sub: { y: (ty + f.s * (f.portrait ? 0.08 : 0.07)) / f.h, font: 'mukta', size: 0.034 },
    };
  },
  setup() {
    // soft shadow drawn once, small, then stretched under the frame
    const shadow = makeCanvas(140, 140);
    const g = shadow.getContext('2d');
    g.shadowColor = '#000000';
    g.shadowBlur = 14;
    g.fillStyle = '#000000';
    roundRect(g, 25, 25, 90, 90, 8);
    g.fill();
    return { shadow, glow: 0, lift: 0 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    // the photo's own blurred extension, softly graded
    backdrop(ctx, f, graded(st, f, 'blur', (g, gw, gh) => {
      tint(g, gw, gh, '#000000', 'source-over', 0.2);
      tint(g, gw, gh, '#ffb48c', 'soft-light', 0.3);
    }), 0.16);
    ctx.drawImage(still(st, f, (g) => vignette(g, f, 0.5)), 0, 0);

    const b = frameBox(f);
    st.glow = follow(st.glow, a.bass * 0.6 + a.level * 0.4, 0.3, 0.04);
    st.lift = follow(st.lift, a.kick, 0.5, 0.08);

    // a soft colour glow behind the frame that breathes with the bass
    if (st.haloCol !== f.color.accent) {
      st.haloCol = f.color.accent;
      st.halo = glowSprite(128, hexToRgb(shade(f.color.accent, 0.2)).join(','), 0.4);
    }
    const gr = Math.max(b.fw, b.fh) * (0.85 + st.glow * 0.25);
    ctx.globalAlpha = 0.42 + st.glow * 0.3;
    ctx.drawImage(st.halo, b.cx - gr, b.cy - gr, gr * 2, gr * 2);
    ctx.globalAlpha = 1;

    // the frame floats up and down slowly and lifts a touch on a kick
    const dy = Math.sin(f.t * 0.6) * s * 0.008 - st.lift * s * 0.004;
    const sc = 1 + st.glow * 0.012;
    const fw = b.fw * sc, fh = b.fh * sc;
    const x = b.cx - fw / 2, y = b.cy - fh / 2 + dy;
    const pad = fw * 0.16;
    ctx.globalAlpha = 0.5 - dy / s * 4;
    ctx.drawImage(st.shadow, x - pad, y - pad + s * 0.022, fw + pad * 2, fh + pad * 2);
    ctx.globalAlpha = 1;
    const z = slowZoom(f, 0.07);
    ctx.save();
    roundRect(ctx, x, y, fw, fh, b.r);
    ctx.clip();
    drawCover(ctx, f.photo.sharp, x, y, fw, fh, z.zoom, z.fx, z.fy);
    // soft sheen across the top
    const sheen = ctx.createLinearGradient(0, y, 0, y + fh);
    sheen.addColorStop(0, 'rgba(255,255,255,0.1)');
    sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, fw, fh);
    ctx.restore();
    roundRect(ctx, x, y, fw, fh, b.r);
    ctx.lineWidth = Math.max(1, s * 0.002);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();

    // thin line wave under the frame, with a slow faint echo
    const n = 48;
    const v = flow(st, 'wave', f, n, 0.5, 0.08);
    const ec = flow(st, 'echo', f, n, 0.1, 0.03);
    const ww = f.portrait ? w * 0.72 : b.fw * 0.9;
    const x0 = b.cx - ww / 2;
    const amp = s * (f.portrait ? 0.05 : 0.04);
    const line = (arr, k, ph) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const taper = Math.pow(Math.sin(Math.PI * u), 1.1);
        pts.push([x0 + u * ww, b.waveY + Math.sin(i * 0.62 - f.t * 2.2 + ph) * (0.06 + arr[i]) * taper * amp * k]);
      }
      return pts;
    };
    const lc = mix(f.color.accent, '#ffffff', 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    smoothLine(ctx, line(ec, 1.3, 1.4));
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.strokeStyle = rgba(lc, 0.35);
    ctx.stroke();
    const lg = ctx.createLinearGradient(x0, 0, x0 + ww, 0);
    lg.addColorStop(0, rgba(lc, 0));
    lg.addColorStop(0.2, 'rgba(255,255,255,0.95)');
    lg.addColorStop(0.8, 'rgba(255,255,255,0.95)');
    lg.addColorStop(1, rgba(lc, 0));
    glowStroke(ctx, line(v, 1, 0), lg, rgba(lc, 0.9), Math.max(1.2, s * 0.003));
    filmGrain(ctx, f, 0.025);
  },
};

// ---------- Ink Wave ----------
const PAPER = '#f5eee4';

const inkWave = {
  id: 'ink',
  name: 'Ink Wave',
  ne: 'मसीको तरंग',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.755, font: 'kalam', size: 0.085, color: '#25212b', style: 'plain' }, sub: { y: 0.795, font: 'kalam', size: 0.04, color: '#4b4450', style: 'plain' } }
    : { title: { y: 0.71, font: 'kalam', size: 0.08, color: '#25212b', style: 'plain' }, sub: { y: 0.785, font: 'kalam', size: 0.038, color: '#4b4450', style: 'plain' } }),
  setup() {
    const r = rng(29);
    const jit = new Float32Array(80);
    for (let i = 0; i < jit.length; i++) jit[i] = r() * 2 - 1;
    return { jit, press: 0 };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    // soft, airy light grade
    backdrop(ctx, f, graded(st, f, 'sharp', (g, gw, gh) => {
      tint(g, gw, gh, '#fff1e0', 'soft-light', 0.45);
      tint(g, gw, gh, '#5a5060', 'screen', 0.35);
      tint(g, gw, gh, PAPER, 'source-over', 0.1);
    }), 0.08);
    // the lower part fades into warm paper, so the ink has a clean page
    ctx.drawImage(still(st, f, (g) => {
      const y0 = h * (f.portrait ? 0.56 : 0.48);
      const pg = g.createLinearGradient(0, y0, 0, h);
      pg.addColorStop(0, rgba(PAPER, 0));
      pg.addColorStop(0.4, rgba(PAPER, 0.8));
      pg.addColorStop(0.7, rgba(PAPER, 0.94));
      pg.addColorStop(1, rgba(PAPER, 0.97));
      g.fillStyle = pg;
      g.fillRect(0, y0, w, h - y0);
      fadeEdge(g, f, 'top', 0.22, 0.25, PAPER);
    }), 0, 0);

    // the brush stroke: a wave whose width swells with the music
    const n = 72;
    const v = flow(st, 'wave', f, n, 0.5, 0.08);
    const ec = flow(st, 'echo', f, n, 0.1, 0.025);
    st.press = follow(st.press, a.level * 0.6 + a.bass * 0.4, 0.35, 0.05);
    const ink = mix(f.color.accent, '#16141e', 0.78);
    const x0 = w * (f.portrait ? 0.08 : 0.1), x1 = w * (f.portrait ? 0.92 : 0.9);
    const cy = h * (f.portrait ? 0.875 : 0.895);
    const amp = s * 0.06;
    const thick = s * (f.portrait ? 0.022 : 0.02);
    const stroke = (arr, k, ph, wk) => {
      const top = [], bot = [], mid = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        // brush lands heavy on the left and lifts off to the right
        const press = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.7);
        const yy = cy + Math.sin(u * 10.5 - f.t * 1.8 + ph) * (0.15 + arr[i]) * amp * k * (0.4 + 0.6 * press);
        const hw = thick * wk * press * (0.35 + arr[i] * 0.9 + st.press * 0.3) * (1 + st.jit[i] * 0.08);
        const x = lerp(x0, x1, u);
        top.push([x, yy - hw]);
        bot.push([x, yy + hw * 0.8]);
        mid.push([x, yy, hw]);
      }
      ctx.beginPath();
      smoothLine(ctx, top);
      smoothLine(ctx, bot.reverse(), false);
      ctx.closePath();
      return mid;
    };
    // pale wash behind, like ink bleeding into the paper
    stroke(ec, 1.15, 0.6, 1.7);
    ctx.fillStyle = rgba(ink, 0.12);
    ctx.fill();
    const mid = stroke(v, 1, 0, 1);
    ctx.fillStyle = rgba(ink, 0.92);
    ctx.fill();
    // dry-brush streaks of paper showing through near the end of the stroke
    ctx.strokeStyle = rgba(PAPER, 0.55);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.0016);
    for (const off of [-0.45, 0.1, 0.5]) {
      ctx.beginPath();
      const pts = [];
      for (let i = Math.floor(n * 0.62); i < n - 2; i++) pts.push([mid[i][0], mid[i][1] + mid[i][2] * off]);
      smoothLine(ctx, pts);
      ctx.stroke();
    }
    // a small ink dot where the brush lifted
    const last = mid[n - 1];
    ctx.fillStyle = rgba(ink, 0.85);
    ctx.beginPath();
    ctx.arc(last[0] + s * 0.022, last[1] - s * 0.004, s * (0.0045 + st.press * 0.002), 0, TAU);
    ctx.fill();
  },
};

export default [lofi, goldenHour, fireflies, floatingFrame, rain, nightStars, bokeh, polaroid, inkWave];
