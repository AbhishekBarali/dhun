// Dhun: the screen. Wires the pickers, looks, words, intro/outro and the
// "Make video" button to the audio engine, renderer and recorder.
import { TEMPLATES, CATEGORIES, templateById } from './templates/index.js';
import { AudioEngine, fakeFeatures, makeFeatures } from './audio.js';
import { loadImageFile, preparePhoto, placeholderPhoto } from './photo.js';
import { FONTS, ensureFont, ensureAllFonts } from './fonts.js';
import { makeItem, applyLayout, drawItem, drawSelection, hitTest, STYLES } from './text.js';
import { Scene, makeFrame, resizeFrame, buildTimeline, segmentAt, drawTimeline } from './renderer.js';
import { Recorder, ScreenAwake, canRecord, extFor, shareBlob, downloadBlob, safeFileName } from './recorder.js';
import { loadSettings, saveSettings, putMedia, getMedia, deleteMedia } from './store.js';
import { t, setLang, getLang } from './i18n.js';
import { formatTime, clamp } from './helpers.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'style') n.style.cssText = v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c) n.append(c);
  return n;
};

const SHAPES = {
  wide: { preview: [960, 540], video: [1920, 1080], thumb: [192, 108] },
  tall: { preview: [540, 960], video: [1080, 1920], thumb: [108, 192] },
  square: { preview: [720, 720], video: [1080, 1080], thumb: [144, 144] },
};
const PARTS = { full: 0, s60: 60, s30: 30, s15: 15 };
const THEMES = [
  { id: 'auto' },
  { id: 'crimson', a: '#ff4d5a', b: '#ffb347' },
  { id: 'gold', a: '#f7b538', b: '#ff7b39' },
  { id: 'sky', a: '#4cc9f0', b: '#4361ee' },
  { id: 'green', a: '#7bd88f', b: '#2ec4b6' },
  { id: 'pink', a: '#ff5fa2', b: '#b15cff' },
  { id: 'violet', a: '#9d7bff', b: '#4cc9f0' },
  { id: 'white', a: '#f4f1ea', b: '#b9c0cc' },
];
const TEXT_COLORS = ['#ffffff', '#ffe8c2', '#ffd166', '#ff5d6c', '#8ecae6', '#9be564', '#111111', 'accent'];
const MAX_CLIP = 30;

const saved = loadSettings();
const audio = new AudioEngine();
const awake = new ScreenAwake();
const scene = new Scene();
const view = $('view');
const vctx = view.getContext('2d');
const fakeA = makeFeatures();

const state = {
  tplId: TEMPLATES.some((x) => x.id === saved.tplId) ? saved.tplId : TEMPLATES[0].id,
  cat: 'all',
  shape: SHAPES[saved.shape] ? saved.shape : 'wide',
  theme: THEMES.some((x) => x.id === saved.theme) ? saved.theme : 'auto',
  part: 'full',
  partStart: 0,
  motion: saved.motion ?? true,
  beatText: saved.beatText ?? false,
  remember: saved.remember ?? true,
  photo: placeholderPhoto(),
  songTitle: '',
  fileNameTouched: false,
  items: [makeItem('title', ''), makeItem('sub', saved.sub || '')],
  selected: null,
  intro: null,
  outro: null,
  recording: null,
  result: null,
};

const pf = makeFrame(...SHAPES[state.shape].preview);
pf.photo = state.photo;

const tpl = () => templateById(state.tplId);
const titleItem = () => state.items.find((i) => i.role === 'title');
const subItem = () => state.items.find((i) => i.role === 'sub');

function persist() {
  saveSettings({
    lang: getLang(), tplId: state.tplId, shape: state.shape, theme: state.theme,
    motion: state.motion, beatText: state.beatText, remember: state.remember,
    sub: subItem() ? subItem().text : '',
  });
}

function colors() {
  const p = state.photo.palette;
  const th = THEMES.find((x) => x.id === state.theme);
  return th && th.a
    ? { accent: th.a, accent2: th.b, light: p.light, dark: p.dark }
    : { accent: p.vivid, accent2: p.vivid2, light: p.light, dark: p.dark };
}

let toastTimer = 0;
function toast(msg, ms = 3200) {
  const n = $('toast');
  n.textContent = msg;
  n.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { n.hidden = true; }, ms);
}

// ---------- song ----------
function prettyName(file) {
  return file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

$('songInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  $('songName').textContent = t('loading');
  try {
    await audio.loadSong(file);
  } catch (err) {
    console.error(err);
    $('songName').setAttribute('data-i18n', 'pickSongSub');
    $('songName').textContent = t('pickSongSub');
    $('songPick').classList.remove('filled');
    toast(t('songError'));
    return;
  }
  const name = prettyName(file);
  $('songName').removeAttribute('data-i18n');
  $('songName').textContent = `${name} · ${formatTime(audio.duration)}`;
  $('songPick').classList.add('filled');
  const title = titleItem();
  if (title && (!title.text || title.text === state.songTitle)) title.text = name;
  state.songTitle = name;
  if (!state.fileNameTouched) $('fileName').value = name;
  state.partStart = 0;
  renderTextRows();
  updateSeek();
  updatePart();
  updatePlay();
});

// ---------- photo ----------
$('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const img = await loadImageFile(file);
    state.photo = preparePhoto(img);
  } catch (err) {
    console.error(err);
    toast(t('photoError'));
    return;
  }
  pf.photo = state.photo;
  const thumb = $('photoThumb');
  thumb.src = state.photo.sharp.toDataURL('image/jpeg', 0.7);
  thumb.hidden = false;
  $('photoIcon').hidden = true;
  $('photoName').removeAttribute('data-i18n');
  $('photoName').textContent = file.name;
  $('photoPick').classList.add('filled');
  renderThemeSwatches();
  renderThumbs();
});

// ---------- preview ----------
function updatePlay() {
  $('playBtn').classList.toggle('on', audio.playing);
  $('playBtn').setAttribute('aria-label', audio.playing ? 'Pause' : 'Play');
}
audio.onended = updatePlay;

$('playBtn').addEventListener('click', async () => {
  await audio.ensure();
  if (!audio.buffer) { toast(t('needSong')); return; }
  if (audio.playing) audio.pause();
  else audio.play();
  updatePlay();
});

function updateSeek() {
  const s = $('seek');
  s.max = String(Math.max(1, audio.duration));
  $('timeTotal').textContent = formatTime(audio.duration);
}
$('seek').addEventListener('input', (e) => {
  const v = Number(e.target.value);
  if (!audio.buffer) return;
  if (audio.playing) audio.play(v);
  else audio.offset = v;
});

function setShape(shape) {
  state.shape = shape;
  const [w, h] = SHAPES[shape].preview;
  view.width = w;
  view.height = h;
  resizeFrame(pf, w, h);
  applyLayout(state.items, tpl(), pf);
  $('looks').classList.toggle('tall', shape === 'tall');
  renderChips('shapeChips', ['wide', 'tall', 'square'], state.shape, (s) => { setShape(s); persist(); }, (s) => t(s));
  renderThumbs();
}

let idleT = 0, lastDraw = 0, lastNow = '';
function drawPreview(now) {
  requestAnimationFrame(drawPreview);
  if (document.hidden || state.recording) return;
  if (now - lastDraw < 30) return; // ~30 fps is plenty for the preview
  const dt = clamp((now - (lastDraw || now)) / 1000, 0.001, 0.1);
  lastDraw = now;
  idleT += dt;
  const f = pf;
  f.dt = dt;
  f.dur = audio.duration || 200;
  f.color = colors();
  f.motion = state.motion;
  if (audio.playing) {
    f.t = audio.time;
    f.a = audio.update(f.t, dt);
  } else {
    f.t = audio.buffer ? audio.offset : idleT;
    f.a = fakeFeatures(idleT, fakeA, dt);
  }
  f.progress = clamp(f.t / f.dur);
  scene.draw(vctx, f);
  const pulse = state.beatText ? f.a.beat * 0.045 : 0;
  for (const it of state.items) {
    if (it.text.trim()) drawItem(vctx, f, it, 1, it.role === 'title' ? pulse : pulse * 0.5);
    else if (it.role === 'title') {
      // Show where the song name will go until one is typed (preview only).
      const keep = it.opacity;
      it.text = t('songLabel');
      it.opacity = 0.35;
      drawItem(vctx, f, it, 1, 0);
      it.text = '';
      it.opacity = keep;
    } else it._box = null;
  }
  drawSelection(vctx, f, state.selected, drag && drag.guide);
  if (audio.buffer) {
    const now2 = formatTime(f.t);
    if (now2 !== lastNow) {
      lastNow = now2;
      $('timeNow').textContent = now2;
      if (!seeking) $('seek').value = String(f.t);
    }
  }
}
let seeking = false;
$('seek').addEventListener('pointerdown', () => { seeking = true; });
window.addEventListener('pointerup', () => { seeking = false; });

// ---------- dragging words on the preview ----------
let drag = null;
function canvasPoint(e) {
  const r = view.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * view.width) / r.width, y: ((e.clientY - r.top) * view.height) / r.height };
}
view.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = hitTest(state.items, p.x, p.y);
  if (!hit) { select(null); return; }
  view.setPointerCapture(e.pointerId);
  drag = { item: hit, dx: hit.x * view.width - p.x, dy: hit.y * view.height - p.y, sx: p.x, sy: p.y, moved: false, guide: false };
  select(hit, false);
});
view.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < view.width * 0.01) return;
  drag.moved = true;
  let x = (p.x + drag.dx) / view.width;
  const y = (p.y + drag.dy) / view.height;
  drag.guide = Math.abs(x - 0.5) < 0.02;
  if (drag.guide) x = 0.5;
  drag.item.x = clamp(x, 0.02, 0.98);
  drag.item.y = clamp(y, 0.03, 0.97);
  drag.item.touched.x = drag.item.touched.y = true;
});
const endDrag = () => {
  if (!drag) return;
  const { item, moved } = drag;
  drag = null;
  if (!moved) select(item, true);
};
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);

// ---------- looks ----------
function renderChips(id, values, current, onPick, label) {
  const box = $(id);
  box.textContent = '';
  for (const v of values) {
    box.append(el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(v === current), text: label(v),
      onclick: () => onPick(v),
    }));
  }
}

function renderCats() {
  renderChips('catChips', CATEGORIES.map((c) => c.id), state.cat, (c) => { state.cat = c; renderCats(); renderLooks(); },
    (c) => { const cat = CATEGORIES.find((x) => x.id === c); return getLang() === 'ne' ? cat.ne : cat.name; });
}

const thumbCanvases = new Map();
function renderLooks() {
  const box = $('looks');
  box.textContent = '';
  for (const tp of TEMPLATES) {
    if (state.cat !== 'all' && tp.cat !== state.cat) continue;
    let c = thumbCanvases.get(tp.id);
    if (!c) { c = document.createElement('canvas'); thumbCanvases.set(tp.id, c); }
    box.append(el('button', {
      class: 'look', type: 'button', 'aria-pressed': String(tp.id === state.tplId),
      onclick: () => pickTemplate(tp.id),
    }, [c, el('span', { text: getLang() === 'ne' ? tp.ne : tp.name })]));
  }
}

function pickTemplate(id) {
  state.tplId = id;
  scene.setTemplate(tpl());
  applyLayout(state.items, tpl(), pf);
  for (const b of $('looks').querySelectorAll('.look')) b.setAttribute('aria-pressed', 'false');
  const idx = TEMPLATES.filter((x) => state.cat === 'all' || x.cat === state.cat).findIndex((x) => x.id === id);
  const btn = $('looks').querySelectorAll('.look')[idx];
  if (btn) btn.setAttribute('aria-pressed', 'true');
  const fonts = state.items.map((i) => ensureFont(i.font, i.text || 'Aa क'));
  Promise.all(fonts).catch(() => {});
  if (state.selected) renderEditor();
  persist();
}

// Draw a small still of every look, a few at a time so the page stays smooth.
let thumbJob = 0;
function renderThumbs() {
  const job = ++thumbJob;
  const [w, h] = SHAPES[state.shape].thumb;
  const list = [...TEMPLATES];
  const step = () => {
    if (job !== thumbJob) return;
    for (const tp of list.splice(0, 3)) {
      const c = thumbCanvases.get(tp.id) || document.createElement('canvas');
      thumbCanvases.set(tp.id, c);
      c.width = w * 2; c.height = h * 2;
      const ctx = c.getContext('2d');
      const f = makeFrame(c.width, c.height);
      f.photo = state.photo;
      f.color = colors();
      f.a = makeFeatures();
      const sc = new Scene();
      sc.setTemplate(tp);
      for (let k = 0; k <= 24; k++) {
        f.t = 2 + k / 24; f.dt = 1 / 24; f.dur = 200; f.progress = f.t / 200;
        fakeFeatures(f.t, f.a, f.dt);
        sc.draw(ctx, f);
      }
    }
    if (list.length) setTimeout(step, 0);
  };
  step();
}

// ---------- words ----------
function roleLabel(it) {
  return it.role === 'title' ? t('songLabel') : it.role === 'sub' ? t('subLabel') : t('extraLabel');
}

function renderTextRows() {
  const box = $('textRows');
  box.textContent = '';
  for (const it of state.items) {
    const input = it.role === 'extra'
      ? el('textarea', { rows: '2', 'aria-label': roleLabel(it) })
      : el('input', { type: 'text', 'aria-label': roleLabel(it), autocomplete: 'off' });
    input.value = it.text;
    if (it.role === 'title') input.placeholder = 'मेरो गीत';
    if (it.role === 'sub') input.placeholder = 'My Channel';
    input.addEventListener('input', () => {
      it.text = input.value;
      ensureFont(it.font, it.text);
      if (it.role === 'title' && !state.fileNameTouched) $('fileName').value = it.text;
      if (it.role === 'sub') persist();
    });
    input.addEventListener('focus', () => select(it, false));
    box.append(el('div', { class: 'text-row' + (state.selected === it ? ' active' : ''), 'data-id': it.id }, [
      el('div', { class: 'row-head' }, [
        el('span', { text: roleLabel(it) }),
        el('button', { class: 'btn small ghost', type: 'button', text: t('edit'), onclick: () => select(it, true) }),
      ]),
      input,
    ]));
  }
}

$('addText').addEventListener('click', () => {
  const it = makeItem('extra', t('newText'));
  applyLayout([it], tpl(), pf);
  it.x = 0.5;
  it.y = 0.5;
  state.items.push(it);
  renderTextRows();
  select(it, true);
});

function select(it, openEditor = false) {
  state.selected = it;
  for (const row of $('textRows').children) row.classList.toggle('active', !!it && row.dataset.id === it.id);
  if (!it) { $('editor').hidden = true; return; }
  renderEditor();
  if (openEditor) {
    $('editor').hidden = false;
    $('editor').scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

function renderEditor() {
  const it = state.selected;
  if (!it) return;
  $('editor').hidden = false;
  $('editorTitle').textContent = roleLabel(it);
  const fonts = $('fontChips');
  fonts.textContent = '';
  for (const fo of FONTS) {
    fonts.append(el('button', {
      class: 'chip font-chip', type: 'button', 'aria-pressed': String(fo.id === it.font),
      style: `font-family: "${fo.family}", Mukta, sans-serif; font-weight: ${fo.weight}`,
      text: fo.latinOnly ? fo.label : `${fo.label} क`,
      onclick: async () => { it.font = fo.id; it.touched.font = true; await ensureFont(fo.id, it.text); renderEditor(); },
    }));
  }
  const size = $('sizeRange');
  size.value = String(it.size);
  size.oninput = () => { it.size = Number(size.value); it.touched.size = true; };
  const cols = $('textColors');
  cols.textContent = '';
  for (const c of TEXT_COLORS) {
    const isAccent = c === 'accent';
    cols.append(el('button', {
      class: 'swatch', type: 'button', 'aria-pressed': String(it.color === c),
      'aria-label': isAccent ? t('auto') : c,
      style: `background: ${isAccent ? `linear-gradient(135deg, ${colors().accent}, ${colors().accent2})` : c}`,
      onclick: () => { it.color = c; it.touched.color = true; renderEditor(); },
    }));
  }
  renderChips('styleChips', STYLES, it.style, (s) => { it.style = s; it.touched.style = true; renderEditor(); }, (s) => t(s));
}

$('editorDone').addEventListener('click', () => select(null));
$('centerText').addEventListener('click', () => {
  const it = state.selected;
  if (!it) return;
  it.x = 0.5; it.y = it.role === 'extra' ? 0.5 : it.y; it.align = 'center';
  it.touched.x = it.touched.align = true;
});
$('deleteText').addEventListener('click', () => {
  const it = state.selected;
  if (!it) return;
  if (it.role === 'extra') state.items = state.items.filter((x) => x !== it);
  else it.text = '';
  select(null);
  renderTextRows();
  persist();
});
$('fileName').addEventListener('input', () => { state.fileNameTouched = true; });

// ---------- intro / outro ----------
function waitFor(target, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout ' + event)), ms);
    target.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
    target.addEventListener('error', () => { clearTimeout(timer); reject(new Error('media error')); }, { once: true });
  });
}

const isVideo = (file) => /^video\//.test(file.type) || /\.(mp4|mov|m4v|webm)$/i.test(file.name || '');

async function loadMedia(slot, file, storedDur) {
  const thumb = document.createElement('canvas');
  thumb.width = 320; thumb.height = 180;
  const tctx = thumb.getContext('2d');
  let media;
  if (isVideo(file)) {
    const v = document.createElement('video');
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    $('mediaPool').append(v);
    v.load();
    await waitFor(v, 'loadedmetadata');
    const dur = Math.min(MAX_CLIP, v.duration || 5);
    if (v.duration > MAX_CLIP + 0.5) toast(t('introLong'));
    media = { type: 'video', el: v, dur, name: file.name };
    try {
      v.currentTime = Math.min(0.5, dur / 3);
      await waitFor(v, 'seeked', 3000);
      tctx.fillStyle = '#000';
      tctx.fillRect(0, 0, 320, 180);
      const r = Math.min(320 / v.videoWidth, 180 / v.videoHeight);
      tctx.drawImage(v, (320 - v.videoWidth * r) / 2, (180 - v.videoHeight * r) / 2, v.videoWidth * r, v.videoHeight * r);
      v.currentTime = 0;
    } catch (e) { /* no still frame, the name is enough */ }
    if (audio.ctx) audio.attachMedia(v);
  } else {
    const img = await loadImageFile(file);
    const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    media = { type: 'image', img: c, dur: storedDur || 3, name: file.name };
    const r = Math.min(320 / c.width, 180 / c.height);
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, 320, 180);
    tctx.drawImage(c, (320 - c.width * r) / 2, (180 - c.height * r) / 2, c.width * r, c.height * r);
  }
  media.thumb = thumb;
  media.file = file;
  clearMedia(slot, false);
  state[slot] = media;
  if (state.remember) putMedia(slot, { kind: media.type, name: file.name, dur: media.dur, blob: file });
  renderMediaBox(slot);
  updateMakeInfo();
}

function clearMedia(slot, forget = true) {
  const m = state[slot];
  if (m && m.type === 'video') {
    m.el.pause();
    URL.revokeObjectURL(m.el.src);
    m.el.remove();
  }
  state[slot] = null;
  if (forget) deleteMedia(slot);
}

function fileInput(slot) {
  const input = el('input', { type: 'file', accept: 'image/*,video/*' });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    audio.ensure();
    try { await loadMedia(slot, file); } catch (e) { console.error(e); toast(t('mediaError')); }
  });
  return input;
}

function renderMediaBox(slot) {
  const box = $(slot + 'Box');
  const m = state[slot];
  box.textContent = '';
  box.classList.toggle('filled', !!m);
  const name = t(slot);
  if (!m) {
    box.append(
      el('span', { class: 'm-plus', text: '+' }),
      el('span', { class: 'm-title', text: name }),
      el('span', { class: 'm-sub', text: t('addMedia') }),
      el('label', { class: 'add', 'aria-label': `${name}: ${t('addMedia')}` }, [fileInput(slot)]),
    );
    return;
  }
  box.append(m.thumb, el('span', { class: 'm-title', text: name }), el('span', { class: 'm-sub', text: `${m.name} · ${formatTime(m.dur)}` }));
  if (m.type === 'image') {
    const lab = el('span', { text: `${m.dur} ${t('seconds')}` });
    const range = el('input', { type: 'range', min: '2', max: '10', step: '1', value: String(m.dur), 'aria-label': `${name} ${t('seconds')}` });
    range.addEventListener('input', () => {
      m.dur = Number(range.value);
      lab.textContent = `${m.dur} ${t('seconds')}`;
      updateMakeInfo();
    });
    range.addEventListener('change', () => {
      if (state.remember) putMedia(slot, { kind: 'image', name: m.name, dur: m.dur, blob: m.file });
    });
    box.append(el('div', { class: 'm-dur' }, [range, lab]));
  }
  box.append(el('div', { class: 'm-actions' }, [
    el('label', { class: 'btn small ghost' }, [t('change'), fileInput(slot)]),
    el('button', {
      class: 'btn small danger', type: 'button', text: t('remove'),
      onclick: () => { clearMedia(slot); renderMediaBox(slot); updateMakeInfo(); },
    }),
  ]));
}

$('rememberMedia').addEventListener('change', (e) => {
  state.remember = e.target.checked;
  for (const slot of ['intro', 'outro']) {
    const m = state[slot];
    if (!state.remember) deleteMedia(slot);
    else if (m) putMedia(slot, { kind: m.type, name: m.name, dur: m.dur, blob: m.file });
  }
  persist();
});

async function restoreMedia() {
  if (!state.remember) return;
  for (const slot of ['intro', 'outro']) {
    const rec = await getMedia(slot);
    if (!rec || !rec.blob) continue;
    const file = rec.blob instanceof File ? rec.blob : new File([rec.blob], rec.name || slot, { type: rec.blob.type });
    try { await loadMedia(slot, file, rec.dur); } catch (e) { console.warn('could not restore', slot, e); }
  }
}

// ---------- more options ----------
function renderThemeSwatches() {
  const box = $('themeColors');
  box.textContent = '';
  for (const th of THEMES) {
    const auto = th.id === 'auto';
    const p = state.photo.palette;
    box.append(el('button', {
      class: 'swatch' + (auto ? ' auto' : ''), type: 'button', 'aria-pressed': String(th.id === state.theme),
      'aria-label': auto ? t('auto') : th.id,
      style: auto ? `box-shadow: inset 4px 0 0 ${p.vivid}, inset -4px 0 0 ${p.vivid2}` : `background: linear-gradient(135deg, ${th.a} 50%, ${th.b} 50%)`,
      text: auto ? t('auto') : '',
      onclick: () => { state.theme = th.id; renderThemeSwatches(); renderThumbs(); persist(); if (state.selected) renderEditor(); },
    }));
  }
}

function songPart() {
  const dur = audio.duration;
  const len = PARTS[state.part];
  if (!len || len >= dur) return { start: 0, len: dur, fade: 0.4 };
  const start = clamp(state.partStart, 0, Math.max(0, dur - len));
  return { start, len, fade: 2 };
}

function updatePart() {
  renderChips('partChips', Object.keys(PARTS), state.part, (p) => { state.part = p; updatePart(); }, (p) => t(p));
  const len = PARTS[state.part];
  const row = $('partStartRow');
  row.hidden = !len || !audio.buffer || len >= audio.duration;
  const r = $('partStart');
  r.max = String(Math.max(0, audio.duration - (len || 0)));
  r.value = String(state.partStart);
  $('partStartLabel').textContent = formatTime(state.partStart);
  updateMakeInfo();
}
$('partStart').addEventListener('input', (e) => {
  state.partStart = Number(e.target.value);
  $('partStartLabel').textContent = formatTime(state.partStart);
  if (audio.buffer) {
    if (audio.playing) audio.play(state.partStart);
    else audio.offset = state.partStart;
  }
  updateMakeInfo();
});

$('motionToggle').checked = state.motion;
$('beatTextToggle').checked = state.beatText;
$('rememberMedia').checked = state.remember;
$('motionToggle').addEventListener('change', (e) => { state.motion = e.target.checked; persist(); });
$('beatTextToggle').addEventListener('change', (e) => { state.beatText = e.target.checked; persist(); });

function timelineLength() {
  if (!audio.buffer) return 0;
  return (state.intro ? state.intro.dur : 0) + songPart().len + (state.outro ? state.outro.dur : 0);
}
function updateMakeInfo() {
  const len = timelineLength();
  $('makeInfo').textContent = len ? t('makeInfo', { len: formatTime(len) }) : '';
}

// ---------- making the video ----------
const clips = () => [state.intro, state.outro].filter((m) => m && m.type === 'video');

function showRec(which) {
  $('recOverlay').hidden = false;
  $('recRunning').hidden = which !== 'running';
  $('recPaused').hidden = which !== 'paused';
  $('recDone').hidden = which !== 'done';
  document.body.style.overflow = 'hidden';
}
function hideRec() {
  $('recOverlay').hidden = true;
  document.body.style.overflow = '';
}

async function makeVideo(test) {
  if (state.recording) return;
  if (!canRecord()) { toast(t('cantRecord'), 6000); return; }
  if (!audio.buffer) {
    toast(t('needSong'));
    $('songPick').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  // These must happen right inside the tap on iPhone: sound, clips, screen lock.
  const ready = audio.ensure();
  for (const m of clips()) audio.attachMedia(m.el);
  if (audio.master) audio.master.gain.value = 0;
  for (const m of clips()) {
    try {
      const p = m.el.play();
      if (p) p.then(() => m.el.pause()).catch(() => {});
    } catch (e) { /* tried */ }
  }
  awake.on();
  await ready;
  audio.pause();
  audio.stop();
  updatePlay();
  select(null);
  for (const m of clips()) { m.el.pause(); m.el.currentTime = 0; }
  await new Promise((r) => setTimeout(r, 250));
  if (audio.master) audio.master.gain.value = 1;

  const [vw, vh] = SHAPES[state.shape].video;
  const canvas = $('recCanvas');
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d');
  const f = makeFrame(vw, vh);
  f.preview = false;
  f.photo = state.photo;
  f.color = colors();
  f.motion = state.motion;
  f.dur = audio.duration;
  const sc = new Scene();
  sc.setTemplate(tpl());
  const items = state.items.filter((i) => i.text.trim()).map((i) => ({ ...i, touched: { ...i.touched } }));
  await Promise.all(items.map((i) => ensureFont(i.font, i.text)));

  const part = songPart();
  const tl = buildTimeline(state.intro, part.len, state.outro);
  const total = test ? Math.min(15, tl.total) : tl.total;
  $('recRunning').querySelector('[data-i18n]').textContent = t(test ? 'testing' : 'recording');
  $('recBar').style.width = '0%';
  $('recTime').textContent = `0:00 / ${formatTime(total)}`;
  showRec('running');

  audio.resetFeatures();
  f.t = part.start;
  f.a = audio.a;
  drawTimeline(ctx, f, 0, { scene: sc, items, beatText: state.beatText, tl });
  let rec;
  try {
    rec = new Recorder(canvas, audio.recordStream, { fps: 30, videoBits: vw * vh >= 1900000 ? 8e6 : 6e6 });
    rec.start();
  } catch (e) {
    console.error(e);
    awake.off();
    hideRec();
    toast(t('cantRecord'), 6000);
    return;
  }
  const t0 = audio.ctx.currentTime + 0.3;
  audio.scheduleSong(t0 + tl.main.start, part.start, part.len, part.fade);
  state.recording = {
    rec, t0, tl, total, f, ctx, scene: sc, items, part, test,
    paused: false, done: false, lastT: 0, started: new Set(), shownSec: -1,
  };
  requestAnimationFrame(recordFrame);
}

function syncClips(R, seg, T) {
  for (const s of R.tl.segs) {
    if (!s.media || s.media.type !== 'video') continue;
    const v = s.media.el;
    if (s === seg) {
      if (!R.started.has(s.kind)) {
        R.started.add(s.kind);
        v.currentTime = clamp(T - s.start, 0, s.dur);
        v.play().catch(() => {});
      } else if (T - s.start >= s.dur - 0.05 && !v.paused) v.pause();
    } else if (!v.paused) v.pause();
  }
}

function recordFrame() {
  const R = state.recording;
  if (!R || R.done) return;
  requestAnimationFrame(recordFrame);
  if (R.paused) return;
  const T = Math.max(0, audio.ctx.currentTime - R.t0);
  const dt = clamp(T - R.lastT, 0.001, 0.1);
  R.lastT = T;
  const seg = segmentAt(R.tl, T);
  syncClips(R, seg, T);
  const f = R.f;
  if (seg.kind === 'main') f.t = R.part.start + (T - seg.start);
  else if (seg.kind === 'outro') f.t = R.part.start + R.part.len;
  f.dt = dt;
  f.progress = clamp(f.t / f.dur);
  f.a = audio.update(T, dt);
  drawTimeline(R.ctx, f, T, { scene: R.scene, items: R.items, beatText: state.beatText, tl: R.tl });
  const sec = Math.floor(T);
  if (sec !== R.shownSec) {
    R.shownSec = sec;
    $('recBar').style.width = `${clamp(T / R.total) * 100}%`;
    $('recTime').textContent = `${formatTime(T)} / ${formatTime(R.total)}`;
  }
  if (T >= R.total) finishRecording();
}

async function finishRecording() {
  const R = state.recording;
  if (!R || R.done) return;
  R.done = true;
  audio.stop();
  for (const m of clips()) m.el.pause();
  let blob;
  try {
    blob = await R.rec.stop();
  } catch (e) {
    console.error(e);
  }
  awake.off();
  state.recording = null;
  if (!blob || !blob.size) { hideRec(); toast(t('failed'), 6000); return; }
  const ext = extFor(blob.type || R.rec.mime);
  const name = safeFileName(($('fileName').value || titleItem().text || state.songTitle) + (R.test ? ' test' : ''), ext);
  if (state.result) URL.revokeObjectURL(state.result.url);
  state.result = { blob, name, url: URL.createObjectURL(blob) };
  const v = $('doneVideo');
  v.src = state.result.url;
  $('doneInfo').textContent = `${name} · ${t('doneInfo', { size: (blob.size / 1048576).toFixed(1), len: formatTime(R.total) })}`;
  showRec('done');
}

function cancelRecording() {
  const R = state.recording;
  if (R) {
    R.done = true;
    R.rec.cancel();
    audio.stop();
    for (const m of clips()) m.el.pause();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  }
  state.recording = null;
  awake.off();
  hideRec();
}

document.addEventListener('visibilitychange', () => {
  const R = state.recording;
  if (document.hidden) {
    if (audio.playing && !R) { audio.pause(); updatePlay(); }
    if (R && !R.done && !R.paused) {
      R.paused = true;
      R.rec.pause();
      if (audio.ctx) audio.ctx.suspend();
      for (const m of clips()) m.el.pause();
      showRec('paused');
    }
  }
});

$('recContinue').addEventListener('click', async () => {
  const R = state.recording;
  if (!R) return;
  try { await audio.ctx.resume(); } catch (e) { /* retried on next tap */ }
  awake.on();
  R.rec.resume();
  R.started.clear(); // let the current clip pick up where the timeline is
  R.paused = false;
  showRec('running');
});
$('recCancel').addEventListener('click', cancelRecording);
$('recCancel2').addEventListener('click', cancelRecording);
$('makeBtn').addEventListener('click', () => makeVideo(false));
$('testBtn').addEventListener('click', () => makeVideo(true));

$('saveBtn').addEventListener('click', async () => {
  const r = state.result;
  if (!r) return;
  const res = await shareBlob(r.blob, r.name);
  if (res === 'unsupported') downloadBlob(r.blob, r.name);
  else if (res === 'cancelled') toast(t('saveHint'), 5000);
});
$('downloadBtn').addEventListener('click', () => {
  const r = state.result;
  if (r) downloadBlob(r.blob, r.name);
});
$('againBtn').addEventListener('click', () => {
  $('doneVideo').pause();
  hideRec();
});

// ---------- language ----------
function applyLang(l) {
  setLang(l);
  $('langBtn').textContent = l === 'ne' ? 'English' : 'नेपाली';
  renderCats();
  renderLooks();
  renderTextRows();
  renderMediaBox('intro');
  renderMediaBox('outro');
  renderThemeSwatches();
  updatePart();
  setShapeChips();
  if (state.selected) renderEditor();
}
function setShapeChips() {
  renderChips('shapeChips', ['wide', 'tall', 'square'], state.shape, (s) => { setShape(s); persist(); }, (s) => t(s));
}
$('langBtn').addEventListener('click', () => { applyLang(getLang() === 'ne' ? 'en' : 'ne'); persist(); });

window.addEventListener('scroll', () => {
  document.querySelector('.stage').classList.toggle('stuck', window.scrollY > 8);
}, { passive: true });

// ---------- start ----------
function start() {
  scene.setTemplate(tpl());
  const deviceNepali = (navigator.language || '').toLowerCase().startsWith('ne');
  applyLang(saved.lang || (deviceNepali ? 'ne' : 'en'));
  setShape(state.shape);
  applyLayout(state.items, tpl(), pf);
  requestAnimationFrame(drawPreview);
  ensureAllFonts().then(renderThumbs);
  restoreMedia();
  window.__dhun = { state, audio }; // handy for testing
}
start();
