# Dhun

Dhun turns a local song and photo into an audio-reactive music video in the
browser. It is a static HTML/CSS/JavaScript app, published on GitHub Pages.

## People and task

The user makes music videos on a phone, including for YouTube and Shorts.
The owner's father is an active user. The interface supports English and Nepali,
and video titles must support Devanagari. Make the choices easy to browse and
the controls comfortable to tap; keep song titles readable.

The workflow is song and photo → choose a look → edit optional words → optional
intro/ending → choose video options → preview and export. Keep the existing
step-by-step editor and sticky preview recognizable.

## Constraints

- Songs and photos stay on the device. No server processing or account is needed.
- Each look must support wide, tall and square outputs and the existing export
  pipeline. Draw from the frame size, user's photo and audio features.
- The original 50 designs and their IDs remain available. Saved choices must
  survive the addition of new designs.
- The user controls photo, song, colours, wording, type, text placement and
  optional overlays. Templates supply useful defaults, not fixed lyrics.
- Maintain phone-friendly rendering: no new per-pixel frame processing,
  full-screen strobing or network-loaded template assets.
- No build step or added runtime package dependency.

## Current extension

Add 30 designs with a mix of minimal, vintage, Nepali-inspired, cinematic,
calm and playful compositions. Help the user find them through category and
New filters, bilingual search and locally saved favourites. Reveal the library
in manageable pages and keep its selected look discoverable.

Success is a design the user likes, with usable default titles, that previews
and exports reliably in each shape. The owner has not selected a single new
preferred design; the collection intentionally offers several different styles.
