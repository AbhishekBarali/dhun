// Fonts for the words on the video. All but the last three can write Nepali
// (Devanagari). They load from Google Fonts in index.html.
export const FONTS = [
  { id: 'mukta', family: 'Mukta', weight: 800, label: 'Mukta' },
  { id: 'baloo', family: 'Baloo 2', weight: 800, label: 'Baloo' },
  { id: 'teko', family: 'Teko', weight: 600, label: 'Teko' },
  { id: 'khand', family: 'Khand', weight: 700, label: 'Khand' },
  { id: 'yatra', family: 'Yatra One', weight: 400, label: 'Yatra' },
  { id: 'rozha', family: 'Rozha One', weight: 400, label: 'Rozha' },
  { id: 'kalam', family: 'Kalam', weight: 700, label: 'Kalam' },
  { id: 'martel', family: 'Martel', weight: 800, label: 'Martel' },
  { id: 'bebas', family: 'Bebas Neue', weight: 400, label: 'Bebas', latinOnly: true },
  { id: 'marker', family: 'Permanent Marker', weight: 400, label: 'Marker', latinOnly: true },
  { id: 'monoton', family: 'Monoton', weight: 400, label: 'Neon', latinOnly: true },
];

export const fontById = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

export function fontCss(id, px, weightOverride) {
  const f = fontById(id);
  const w = weightOverride || f.weight;
  // Mukta as a fallback so Nepali letters still show with Latin-only fonts.
  return `${w} ${Math.round(px)}px "${f.family}", "Mukta", system-ui, sans-serif`;
}

// The Google Fonts stylesheet may still be downloading when the app starts.
// Asking for a font before it arrives silently does nothing, so wait for it.
let cssReady = null;
function fontCssLoaded() {
  if (!cssReady) {
    cssReady = new Promise((resolve) => {
      const link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
      if (!link || link.sheet) { resolve(); return; }
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 10000);
    });
  }
  return cssReady;
}

// Make sure a font is downloaded before drawing it on the canvas.
export async function ensureFont(id, text = 'Aa कखग') {
  if (!document.fonts || !document.fonts.load) return;
  await fontCssLoaded();
  const f = fontById(id);
  try {
    await Promise.all([
      document.fonts.load(`${f.weight} 40px "${f.family}"`, text),
      document.fonts.load(`500 40px "Mukta"`, text),
    ]);
  } catch (e) { /* draw with fallback */ }
}

export async function ensureAllFonts() {
  await Promise.all(FONTS.map((f) => ensureFont(f.id, f.latinOnly ? 'Aa' : 'Aa कखग')));
}
