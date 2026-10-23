# Writing a look (template)

A look is a plain object in one of the family files in `js/templates/`
(`simple.js`, `nepali.js`, `hiphop.js`, `dance.js`, `calm.js`). Each file
exports an array of looks. `js/templates/simple.js` has two complete examples.

```js
{
  id: 'soft-wave',          // unique, kebab-case
  name: 'Soft Wave',        // English name shown on the card
  ne: 'मधुर तरंग',           // Nepali name
  cat: 'simple',            // simple | nepali | hiphop | dance | calm
  text(f) {                 // optional: where the words go by default
    return { title: { y: 0.13, font: 'teko', upper: true }, sub: { y: 0.2 } };
  },
  setup(f) { return {} },   // optional: runs when the look or video size changes
  draw(ctx, f, st) {},      // required: paint the whole frame, every frame
}
```

## The frame `f`

| field | meaning |
| --- | --- |
| `f.w`, `f.h` | canvas size in pixels (small preview, 1080p video, wide/tall/square) |
| `f.s` | the shorter side. Size everything from `f.s`, `f.w`, `f.h` |
| `f.portrait`, `f.square` | shape of the video |
| `f.t`, `f.dt` | seconds into the song, seconds since last frame |
| `f.dur`, `f.progress` | song length, 0..1 position |
| `f.photo.sharp` / `.blur` / `.gray` | the user's photo, a blurred copy, a black & white copy (canvases) |
| `f.photo.palette` | `{ dark, mid, light, vivid, vivid2 }` colours from the photo |
| `f.color.accent`, `f.color.accent2` | the colours the user picked (default: from the photo) |
| `f.motion` | user wants the slow photo zoom (handled by `photoBackground` / `slowZoom`) |
| `f.a` | the music, see below |

`f.a` (all 0..1 unless noted): `bands` (Float32Array of 64, bass first),
`wave` (Float32Array of 1024, -1..1), `bass`, `mid`, `high`, `level`,
`kick` (sharp envelope on each kick), `beat` (jumps to 1 on a beat, fades),
`beatHit` (true on the frame a beat lands), `beats` (count), `energy` (slow
average: quiet verse vs loud chorus).

## Text layout

The title (song name) and second line (singer or channel) are drawn by the
app on top of the look. `text(f)` sets their defaults; the user can still drag
them anywhere. Fields: `x`, `y` (centre, 0..1 of width/height), `size`
(fraction of `f.s`, title is ~0.075), `align`, `font` (an id from
`js/fonts.js`), `color` (hex, or `'accent'` / `'accent2'`), `style`
(`shadow`, `outline`, `glow`, `box`, `tag`, `plain`), `upper`, `opacity`.
Leave clear space where the words go.

## Helpers (`js/helpers.js`)

`photoBackground(ctx, f, { kind, dim, punch, zoom, shake })`, `drawCover`,
`drawContain`, `circlePhoto`, `coverPhoto`, `slowZoom`, `vignette`,
`fadeEdge`, `grain`, `roundRect`, `smoothLine`, `smoothLoop`, `withGlow`,
`band`, `resample`, `mirrored`, `rng`, `noise1`, `rgba`, `mix`, `shade`,
`hsl`, `clamp`, `lerp`, `smooth`, `ease`, `formatTime`, `TAU`.

## Rules

- Paint every pixel each frame (start with a background).
- Work at every size and shape. Use `f.portrait` to move things for Shorts.
- Keep state in `setup()`, positions as fractions of the frame, randomness
  from `rng(seed)`, so the preview and the video match.
- It must run at 30 fps at 1920×1080 on a phone: no per-pixel loops per frame,
  `shadowBlur` only on a few shapes, no new big arrays every frame, at most a
  few hundred particles.
- No `ctx.filter` (Safari does not support it on canvas).
- No full-screen flashing faster than 3 times a second.
- Check it: `dev/gallery.html?cat=<family>&shape=wide|tall|square&photo=...`
