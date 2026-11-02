import { templateById } from '../js/templates/index.js';
import { Scene, makeFrame, buildTimeline, drawTimeline } from '../js/renderer.js';
import { fakeFeatures, makeFeatures } from '../js/audio.js';
import { placeholderPhoto } from '../js/photo.js';
import { makeItem, applyLayout } from '../js/text.js';
import { ensureAllFonts } from '../js/fonts.js';
import { fastExportConfig, mixSoundtrack, exportVideo } from '../js/exporter.js';

document.getElementById('run').addEventListener('click', async () => {
  const button = document.getElementById('run'), status = document.getElementById('status');
  button.disabled = true; status.textContent = 'Preparing…';
  try {
    await ensureAllFonts();
    const config = await fastExportConfig(1920, 1080, 30);
    if (!config) throw new Error('WebCodecs export is unavailable in this browser.');
    const total = 6, rate = 48000;
    const song = new AudioBuffer({ length: total * rate, sampleRate: rate, numberOfChannels: 2 });
    for (let ch = 0; ch < 2; ch++) {
      const data = song.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const t = i / rate, envelope = Math.min(1, t * 5, (total - t) * 5) * (0.4 + 0.6 * Math.exp(-8 * (t % 0.5)));
        data[i] = Math.sin(t * 220 * Math.PI * 2) * 0.12 * envelope;
      }
    }
    const tl = buildTimeline(null, total, null);
    const soundtrack = await mixSoundtrack({ song, part: { start: 0, len: total, fade: 0.3 }, tl });
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext('2d'), f = makeFrame(1920, 1080);
    f.photo = placeholderPhoto(); f.a = makeFeatures(); f.dur = total;
    const ids = ['linen', 'mixtape', 'sajha-radio', 'opening-credits', 'moon-window', 'groove-stack'];
    const scene = new Scene();
    const items = [makeItem('title', 'मेरो माया'), makeItem('sub', 'Dhun · export test')];
    let current = '';
    const blob = await exportVideo({ canvas, config, soundtrack, total, job: { cancelled: false },
      onProgress: (done, count) => { status.textContent = `Exporting ${done}/${count} frames…`; },
      drawFrame: (t, dt) => {
        const id = ids[Math.min(5, Math.floor(t))];
        if (id !== current) { current = id; scene.setTemplate(templateById(id)); applyLayout(items, templateById(id), f); }
        f.t = t; f.dt = dt; f.progress = t / total; fakeFeatures(t, f.a, dt);
        drawTimeline(ctx, f, t, { scene, items, tl, beatText: false });
        if (scene.failed) throw new Error(`Template failed during export: ${id}`);
      },
    });
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
    const video = document.getElementById('output');
    video.src = dataUrl; video.hidden = false;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
    if (Math.abs(video.duration - total) > 0.15 || video.videoWidth !== 1920 || video.videoHeight !== 1080) throw new Error('Unexpected encoded video dimensions or duration');
    const link = document.getElementById('download'); link.href = dataUrl; link.hidden = false;
    status.textContent = `PASS: ${video.videoWidth} × ${video.videoHeight}, ${video.duration.toFixed(2)} seconds, ${Math.round(blob.size / 1024)} KB. Six new families, video and audio encoded.`;
  } catch (error) { status.textContent = `FAIL: ${error.message || error}`; }
  finally { button.disabled = false; }
});
