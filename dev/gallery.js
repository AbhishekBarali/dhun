// Developer gallery: draws every template with made-up music so looks can be
// checked side by side. Query options:
//   ?cat=nepali        only one family        ?id=soft-wave   only one look
//   ?shape=wide|tall|square                   ?photo=samples/x.jpg
//   ?times=1,4.5,9     one tile per time       ?size=480  long side of a tile
//   ?title=...&sub=...  words to show
import { TEMPLATES } from '../js/templates/index.js';
import { Scene, makeFrame } from '../js/renderer.js';
import { fakeFeatures, makeFeatures } from '../js/audio.js';
import { placeholderPhoto, preparePhoto } from '../js/photo.js';
import { makeItem, applyLayout, drawItems } from '../js/text.js';
import { ensureAllFonts } from '../js/fonts.js';

const q = new URLSearchParams(location.search);
const shape = q.get('shape') || 'wide';
const long = Number(q.get('size') || 480);
const dims = { wide: [long, Math.round(long * 9 / 16)], tall: [Math.round(long * 9 / 16), long], square: [long, long] }[shape];
const times = (q.get('times') || '4.3').split(',').map(Number);
const errors = [];
window.__errors = errors;
window.addEventListener('error', (e) => errors.push(String(e.message)));

async function loadPhoto() {
  const src = q.get('photo');
  if (!src) return placeholderPhoto();
  const img = new Image();
  img.src = src;
  await img.decode();
  return preparePhoto(img);
}

async function main() {
  await ensureAllFonts();
  const photo = await loadPhoto();
  let list = TEMPLATES;
  if (q.get('cat')) list = list.filter((t) => t.cat === q.get('cat'));
  if (q.get('id')) list = list.filter((t) => q.get('id').split(',').includes(t.id));
  const grid = document.getElementById('grid');
  for (const tpl of list) {
    for (const T of times) {
      const c = document.createElement('canvas');
      c.width = dims[0]; c.height = dims[1];
      const fig = document.createElement('figure');
      const cap = document.createElement('figcaption');
      cap.textContent = `${tpl.id} · ${tpl.name} · ${tpl.ne} · ${tpl.cat} · t=${T}`;
      fig.append(c, cap);
      grid.append(fig);
      const ctx = c.getContext('2d');
      const f = makeFrame(c.width, c.height);
      f.photo = photo;
      f.a = makeFeatures();
      f.color = { accent: photo.palette.vivid, accent2: photo.palette.vivid2, light: photo.palette.light, dark: photo.palette.dark };
      f.dur = 200;
      const scene = new Scene();
      scene.setTemplate(tpl);
      const items = [
        makeItem('title', q.get('title') || 'मेरो माया'),
        makeItem('sub', q.get('sub') || 'Ram Barali Music'),
      ];
      applyLayout(items, tpl, f);
      try {
        // Run the frames before T so moving parts (particles, petals) settle.
        const fps = 30, start = Math.max(0, T - 4);
        for (let t = start; t <= T + 1e-6; t += 1 / fps) {
          f.t = t; f.dt = 1 / fps; f.progress = t / f.dur;
          fakeFeatures(t, f.a, f.dt);
          scene.draw(ctx, f);
        }
        drawItems(ctx, f, items, { alpha: 1 });
        if (scene.failed) throw new Error('draw() threw - see console');
        if (q.get('perf') && T === times[0]) {
          // Time 60 frames at full video size (?perf=1).
          const big = document.createElement('canvas');
          big.width = shape === 'tall' ? 1080 : 1920;
          big.height = shape === 'wide' ? 1080 : shape === 'tall' ? 1920 : 1080;
          if (shape === 'square') big.width = 1080;
          const bctx = big.getContext('2d');
          const bf = makeFrame(big.width, big.height);
          Object.assign(bf, { photo: f.photo, a: f.a, color: f.color, dur: f.dur });
          const bs = new Scene();
          bs.setTemplate(tpl);
          const t0 = performance.now();
          for (let k = 0; k < 60; k++) {
            bf.t = 2 + k / 30; bf.dt = 1 / 30;
            fakeFeatures(bf.t, bf.a, bf.dt);
            bs.draw(bctx, bf);
          }
          bctx.getImageData(0, 0, 1, 1); // wait for drawing to finish
          const ms = (performance.now() - t0) / 60;
          window.__perf = window.__perf || {};
          window.__perf[tpl.id] = Math.round(ms * 10) / 10;
          cap.textContent += ` · ${ms.toFixed(1)} ms/frame @${big.width}x${big.height}`;
        }
      } catch (e) {
        errors.push(`${tpl.id}: ${e.message}`);
        cap.classList.add('err');
        cap.textContent += ' ERROR ' + e.message;
      }
    }
  }
  window.__done = true;
}
main().catch((e) => { errors.push(String(e && e.stack || e)); window.__done = true; });
