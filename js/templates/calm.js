// Calm & sad looks: love songs, sad songs, lo-fi and slow ballads.
// Soft colours and slow movement that still follows the music.
import {
  TAU, clamp, lerp, rgba, shade, mirrored, smoothLine, rng, noise1,
  drawCover, fadeEdge, vignette, roundRect,
  withGlow, slowZoom, formatTime,
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

// ---------- Lo-fi ----------
const lofi = {
  id: 'lofi',
  name: 'Lo-fi',
  ne: 'लो-फाइ',
  cat: 'calm',
  text: (f) => (f.portrait
    ? { title: { y: 0.68, font: 'kalam', size: 0.09 }, sub: { y: 0.725, font: 'kalam', size: 0.045, opacity: 0.9 } }
    : { title: { y: 0.64, font: 'kalam', size: 0.085 }, sub: { y: 0.73, font: 'kalam', size: 0.042, opacity: 0.9 } }),
  setup() {
    const r = rng(11);
    const dust = [];
    for (let i = 0; i < 36; i++) dust.push({ x: r(), y: r(), z: 0.4 + r() * 0.6, ph: r() * TAU });
    return { dust, bars: new Float32Array(26), eq: [0, 0, 0], leak: glowSprite(128, '255,160,90') };
  },
  draw(ctx, f, st) {
    const { w, h, s, a } = f;
    // warm, faded film tone with lifted blacks
    backdrop(ctx, f, graded(st, f, 'sharp', (g, gw, gh) => {
      tint(g, gw, gh, '#ff9450', 'soft-light', 0.6);
      tint(g, gw, gh, '#000000', 'source-over', 0.06);
      tint(g, gw, gh, '#33241d', 'lighten');
    }), 0.1);

    // a warm light leak drifting along the top, stronger in loud parts
    const lx = w * (0.5 + 0.42 * Math.sin(f.t * 0.06)), ly = h * (0.06 + 0.06 * Math.cos(f.t * 0.05));
    const lr = s * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + a.energy * 0.25;
    ctx.drawImage(st.leak, lx - lr, ly - lr, lr * 2, lr * 2);
    ctx.restore();

    // edge fade, vignette and the cosy rounded frame never move: one layer
    const ins = s * 0.026;
    ctx.drawImage(still(st, f, (g) => {
      fadeEdge(g, f, 'bottom', 0.55, 0.72, '#140c08');
      vignette(g, f, 0.5);
      g.fillStyle = '#1c130f';
      roundRect(g, ins, ins, w - ins * 2, h - ins * 2, s * 0.05);
      g.rect(0, 0, w, h);
      g.fill('evenodd');
    }), 0, 0);

    // dust floating slowly in the light
    ctx.fillStyle = '#fff1dc';
    for (const d of st.dust) {
      d.x += f.dt * 0.008 * d.z;
      d.y -= f.dt * 0.005 * d.z;
      if (d.x > 1.02) d.x -= 1.04;
      if (d.y < -0.02) d.y += 1.04;
      ctx.globalAlpha = clamp((0.18 + 0.2 * Math.sin(f.t * 0.8 + d.ph)) * d.z + a.high * 0.25);
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, s * 0.0028 * d.z, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // small rounded wave: soft pill-shaped bars
    const n = st.bars.length;
    const m = mirrored(a.bands, n);
    const bw = w * (f.portrait ? 0.62 : 0.34);
    const x0 = (w - bw) / 2, step = bw / (n - 1);
    const cy = h * (f.portrait ? 0.795 : 0.845);
    const maxH = s * (f.portrait ? 0.08 : 0.085);
    ctx.lineCap = 'round';
    ctx.lineWidth = step * 0.52;
    ctx.strokeStyle = 'rgba(255,240,222,0.95)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      st.bars[i] = lerp(st.bars[i], m[i], 0.3);
      const taper = 0.3 + 0.7 * Math.sqrt(Math.sin(Math.PI * (i / (n - 1))));
      const hh = maxH * (0.06 + st.bars[i] * taper * (1 + a.kick * 0.1));
      const x = x0 + i * step;
      ctx.moveTo(x, cy - hh / 2);
      ctx.lineTo(x, cy + hh / 2);
    }
    ctx.stroke();

    // progress line with times, like a little music player
    const py = cy + s * 0.075;
    const lw = Math.max(1.5, s * 0.004);
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(255,240,222,0.3)';
    ctx.beginPath();
    ctx.moveTo(x0, py);
    ctx.lineTo(x0 + bw, py);
    ctx.stroke();
    const px = x0 + bw * clamp(f.progress);
    ctx.strokeStyle = 'rgba(255,240,222,0.9)';
    ctx.beginPath();
    ctx.moveTo(x0, py);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = '#fff0dc';
    ctx.beginPath();
    ctx.arc(px, py, lw * 2.2, 0, TAU);
    ctx.fill();
    ctx.font = fontCss('mukta', s * 0.026, 500);
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.8;
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
    const bx = ins + s * 0.035, by = ins + s * 0.035;
    roundRect(ctx, bx, by, pw, ph, ph / 2);
    ctx.fillStyle = 'rgba(28,18,14,0.6)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.0018);
    ctx.strokeStyle = 'rgba(255,230,200,0.3)';
    ctx.stroke();
    const lv = [a.bass, a.mid * 1.3, a.high * 2];
    const ew = icon / 4.2;
    ctx.fillStyle = shade(f.color.accent, 0.35);
    for (let i = 0; i < 3; i++) {
      st.eq[i] = lerp(st.eq[i], clamp(lv[i]), 0.35);
      const eh = ph * (0.18 + 0.45 * st.eq[i]);
      roundRect(ctx, bx + fs * 0.75 + i * ew * 1.6, by + ph / 2 + ph * 0.3 - eh, ew, eh, ew / 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff0dc';
    ctx.textAlign = 'left';
    ctx.fillText(label, bx + fs * 1.1 + icon, by + ph / 2 + fs * 0.06);

    filmGrain(ctx, f, 0.09);
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

export default [lofi, rain, nightStars, bokeh, polaroid];
