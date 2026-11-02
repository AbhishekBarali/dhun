import { TEMPLATES } from '../js/templates/index.js';
import { Scene, makeFrame, buildTimeline, drawTimeline } from '../js/renderer.js';
import { fakeFeatures, makeFeatures } from '../js/audio.js';
import { placeholderPhoto, preparePhoto } from '../js/photo.js';
import { makeItem, applyLayout, drawItems } from '../js/text.js';
import { ensureAllFonts } from '../js/fonts.js';

const failures = [];
let checks = 0;
const check = (ok, message) => { checks++; if (!ok) failures.push(message); };
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

async function main() {
  await ensureAllFonts();
  const sample = placeholderPhoto();
  const source = document.createElement('canvas'); source.width = 300; source.height = 500;
  const sc = source.getContext('2d'); sc.fillStyle = '#fcf6dc'; sc.fillRect(0, 0, 300, 500);
  sc.fillStyle = '#234836'; sc.fillRect(90, 60, 120, 380);
  const portraitPhoto = preparePhoto(source);
  const shapes = [[640, 360], [360, 640], [480, 480]];
  for (const tpl of TEMPLATES) {
    for (const [w, h] of shapes) {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const f = makeFrame(w, h); f.photo = sample; f.a = makeFeatures();
      const scene = new Scene(); scene.setTemplate(tpl);
      for (const time of [0, 4.3, 179]) {
        f.t = time; f.progress = time / 180;
        if (time) fakeFeatures(time, f.a, f.dt);
        scene.draw(ctx, f);
        check(!scene.failed, `${tpl.id} failed at ${w}x${h}, t=${time}`);
        // All exported video frames must be opaque, including their corners.
        for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
          check(ctx.getImageData(x, y, 1, 1).data[3] === 255, `${tpl.id}: transparent corner ${x},${y}`);
        }
      }
      if (tpl.isNew) {
        const items = [makeItem('title', 'सम्झनामा तिमी — A very long song title for the people we love'), makeItem('sub', 'गायकको नाम · Artist and channel name')];
        applyLayout(items, tpl, f); drawItems(ctx, f, items, {});
        for (const it of items) {
          const b = it._box;
          check(b && b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h, `${tpl.id}: ${it.role} out of bounds at ${w}x${h}`);
        }
        f.photo = portraitPhoto; f.motion = false;
        const tl = buildTimeline(null, 180, null);
        drawTimeline(ctx, f, 42, { scene, items, tl, beatText: false });
        check(!scene.failed, `${tpl.id}: export timeline with portrait photo`);
        check(ctx.getTransform().isIdentity, `${tpl.id}: transform escaped the scene`);
        // Hold time, progress and photo still: animation must also respond to
        // audio, rather than merely looking animated because the clock moves.
        f.t = 42; f.progress = 0.5; f.a = makeFeatures();
        scene.draw(ctx, f);
        const quietPixels = ctx.getImageData(0, 0, w, h).data;
        f.a.bands.fill(0.85); f.a.wave.fill(0.7);
        Object.assign(f.a, { bass: 0.9, mid: 0.8, high: 0.7, level: 0.8, kick: 0.7, beat: 0.8, energy: 0.8 });
        scene.draw(ctx, f);
        const loudPixels = ctx.getImageData(0, 0, w, h).data;
        check(quietPixels.some((value, i) => value !== loudPixels[i]), `${tpl.id}: no audio response at ${w}x${h}`);
      }
    }
    document.getElementById('status').textContent = `Checking ${tpl.name}…`;
    await pause();
  }
  document.getElementById('status').textContent = failures.length ? `FAIL: ${failures.length} checks` : `PASS: ${checks} checks`;
  document.getElementById('result').textContent = failures.length ? failures.join('\n')
    : '80 templates × 3 shapes × 3 audio positions. All frames painted. New title layouts stay in bounds. Export timeline, portrait photos, disabled zoom and audio response in every new layout passed.';
}
main().catch((error) => {
  document.getElementById('status').textContent = 'FAIL: test runner';
  document.getElementById('result').textContent = error.stack;
});
