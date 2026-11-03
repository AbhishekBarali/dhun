---
name: Dhun
description: A phone-first, bilingual music-video editor with a photo-led look library.
colors:
  bg: "#14111a"
  card: "#1e1a26"
  card2: "#282233"
  line: "#3a3246"
  text: "#f6f1ea"
  muted: "#b9afbd"
  accent: "#e8424f"
  accent-2: "#f2a93b"
  ok: "#4cc38a"
  canvas-paper: "#f1ecdf"
  canvas-ink: "#262823"
  canvas-cream: "#f8f3e7"
typography:
  title:
    fontFamily: "Mukta, system-ui, -apple-system, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Mukta, system-ui, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Mukta, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  look-title:
    fontFamily: "Mukta, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  look-description:
    fontFamily: "Mukta, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  small: "8px"
  field: "12px"
  control: "14px"
  card: "16px"
  pill: "999px"
  circle: "50%"
spacing:
  small: "8px"
  field: "12px"
  card: "14px"
  section: "16px"
components:
  button-primary:
    textColor: "#fff"
    rounded: "{rounded.control}"
    padding: "0 18px"
  button-secondary:
    backgroundColor: "{colors.card2}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 18px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.accent-2}"
    rounded: "{rounded.control}"
    padding: "0 18px"
  text-field:
    backgroundColor: "{colors.card2}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  collection-nav:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.field}"
    padding: "4px"
  chip:
    backgroundColor: "{colors.card2}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 15px"
  chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "#fff"
    rounded: "{rounded.pill}"
    padding: "0 15px"
  step-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  look-card:
    backgroundColor: "{colors.card2}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "0"
---

# Design System: Dhun

## Overview

**Creative North Star: "Phone-first music-video editor"**

Dhun uses a familiar, compact dark-plum editor around a prominent video preview. Warm text, coral actions and amber selection cues help people make a video in English or Nepali. Numbered cards keep the song-and-photo workflow understandable on a phone.

This is the established system with an expanded look library. The canvas supplies the expressive range: the original 50 looks remain, joined by 30 distinct minimal, vintage, Nepali-inspired, cinematic, calm and playful compositions. The surrounding controls stay visually consistent as the user's photo and chosen composition change.

**Key Characteristics:**

- A centered single column with a sticky preview and numbered editing cards.
- Dark-plum surfaces, warm text, coral actions and amber state cues.
- Bilingual labels and editable canvas titles with Devanagari fallback.
- Photo-led canvas compositions with restrained audio response and separate browsing controls.

Recorded from `css/app.css`, `index.html`, `js/app.js`, `js/look-library.js`, `js/fonts.js`, `js/text.js`, `js/renderer.js`, and `js/templates/`. Product constraints are in `PRODUCT.md`; template authoring details remain in `docs/templates.md`. The schema-v2 sidecar, `.impeccable/design.json`, holds focus, shadow, motion, breakpoint and component examples that do not fit the frontmatter. Its synthesized tonal ramps are display metadata, not an expanded application palette.

## Colors

The editor pairs warm dark-plum neutrals with two functional accents; individual video compositions have their own palettes.

### Primary

- **Coral (`accent`)** identifies numbered steps, ordinary selected option chips, range inputs and recording activity. Primary export actions use the existing coral gradient, recorded in the sidecar.

### Secondary

- **Amber (`accent-2`)** marks the selected look, focus outlines, text editing, links and the active library collection. It also colours the Nepali wordmark.
- **Success green (`ok`)** is reserved for the completed-video message.

### Neutral

- **Deep plum (`bg`)** is the page, sticky preview and inset discovery-control background.
- **Plum (`card`)** groups workflow steps; **raised plum (`card2`)** supports controls and thumbnails.
- **Muted plum (`line`)** outlines cards, controls and dividers.
- **Warm white (`text`)** carries primary text; **soft lilac (`muted`)** carries supporting descriptions and labels.
- **Paper, ink and cream (`canvas-paper`, `canvas-ink`, `canvas-cream`)** are shared drawing constants for several new looks. They are canvas materials, not replacement editor surfaces.

**The Canvas Palette Rule.** Keep the editor palette stable while allowing each composition to use its own materials and the user's photo-derived or chosen accents.

## Typography

**Interface font:** Mukta, with system-ui, -apple-system and sans-serif fallbacks. The compact hierarchy uses the frontmatter's title, body, label, look-title and look-description roles; form text is slightly larger (18px). Search and collection controls use regular text (16px); category controls and result counts use smaller text (14px). Times and counts use tabular numerals where implemented.

**Canvas fonts:** Mukta (800), Baloo 2 (800), Teko (600), Khand (700), Yatra One (400), Rozha One (400), Kalam (700) and Martel (800) support Devanagari. Bebas Neue (400), Permanent Marker (400) and Monoton (400) are Latin-only choices. Every canvas stack falls back through Mukta, system-ui and sans-serif; do not remove Mukta when a Latin display face is selected. The existing Google Fonts stylesheet supplies these faces.

New looks choose a title face to suit the composition: Martel for several paper and cinematic layouts, Yatra or Rozha for several Nepali layouts, Kalam for handwritten layouts, and Khand or Baloo for bold/playful layouts. Their shared second-line default uses Mukta. This variety belongs to the video, not the editor chrome.

**The Editable Title Rule.** Reserve a clear title area in each shape and provide text defaults through the shared text renderer. Do not paint fixed song names or lyrics into a look. Titles shrink to their allocated maximum width; explicit newlines remain supported. The shared new-look defaults use plain text, title size relative to the shorter canvas side, and a smaller second line at reduced opacity. User-edited text properties survive look changes.

## Layout

- The header and main editor are centered with a maximum width (640px). Main content has side gutters (12px), bottom space (24px), and safe-area handling. Desktop retains this single-column editor.
- The preview sticks to the top, with its canvas constrained to available width and a maximum height (40vh). Cards follow at a regular gap (14px) with matching internal padding. The export overlay uses a narrower maximum width (560px) and a preview limit (46vh).
- The look grid has two equal columns and a gap (12px); at a minimum viewport width (540px), it has three columns. At a maximum width (360px), collection labels and card names become smaller and category-chip horizontal padding tightens. Categories wrap; the existing font and text-style strips scroll horizontally.
- Discovery proceeds through collection, search, category, result count, current selection, then thumbnails. The library reveals 12 results at a time. Search, category and collection filters combine; matching new looks appear first. Clear filters and Find selected restore access to the current selection without changing it.
- Thumbnail canvases use the selected output shape and sample editable titles. They render cached stills in small batches, rather than animating the entire library. The 80 stable template IDs retain the original 50, with five additions from each new family.
- Wide (16:9), tall (9:16) and square (1:1) are supported. Export frames are respectively 1920×1080, 1080×1920 and 1080×1080. Canvas geometry scales from width, height and the shorter side; layouts can stack or redistribute photos, ornaments and title space by shape.

**The Three Shapes Rule.** A look is one composition adapted to all three output shapes. Verify the photo, editable title, second line and audio detail together in each shape; cropping a wide layout is not sufficient.

## Elevation & Depth

The editor uses tonal layers and fine borders for most separation. Shadows are limited to the sticky preview boundary, the coral primary action and the temporary toast; their exact values are in the sidecar. The play control uses a translucent black circle with backdrop blur (6px). The recording overlay is nearly opaque and sits above the editor.

Canvas depth is composition-specific: paper mounts, overlapping photos, record sleeves, blurred copies of the user's photo and gradients are legitimate drawing materials. They do not establish a global shadow style for editor controls.

Interface state changes are immediate; the stylesheet adds no general transition system. The recording dot blinks over a cycle (1.2s) and stops animating under reduced-motion preference. Canvas audio motion remains part of video rendering, with the existing slow-photo-zoom and beat-text options controlled separately by the user.

## Shapes

The editor uses softly rounded cards, controls and fields. Rounded fields also frame previews and look cards; the larger card radius groups a whole workflow step. Pills identify ordinary option chips. Circular step numbers, play controls, swatches and saved-look controls are purposeful exceptions.

Borders generally use a thin stroke (1px); look selection uses a stronger stroke (2px). Empty media pickers use a dashed stroke (2px), becoming solid once filled. Canvas compositions may use square photos, circles, arches, film frames and rotated paper mounts; preserve the geometry that makes each look distinct.

## Components

### Buttons

Primary actions retain the coral vertical gradient, white text, soft shadow and rounded control shape. Standard buttons have a minimum height (48px); the full-width export action increases it (60px). Secondary buttons use raised plum; ghost buttons remove the fill; links use amber and an underline. Disabled buttons have reduced opacity (0.5). The small and link variants use a minimum height (40px), so do not describe every existing control as 48px.

All keyboard-focusable elements receive an amber outline (3px) with an offset (2px), except where the search wrapper explicitly carries that ring. Existing buttons do not add a generic hover lift or transition.

### Collection navigation and chips

All, New and Saved form an inset segmented group. Each segment has a minimum height (44px); selection uses raised plum and amber text. Category chips also have a minimum height (44px), with a muted maroon fill, rose border and cream text when selected. These are intentionally quieter than the coral selected state of the ordinary shape, font and option chips. State is exposed through `aria-pressed`, not colour alone.

### Look cards and saved controls

Each card combines a real canvas still, a bold name and a short muted description. New looks carry a compact status badge over the image. The selected card has an amber border and name; on hover-capable devices, unselected cards use a lighter plum border while selected cards retain amber.

Saving is a separate circular button over the thumbnail with an inline SVG heart and a target (44×44px). The saved state fills the heart and changes its colour. Keep choosing a look and saving it independent. New and Saved collection counts, category counts and the polite result-status region reflect the active filters. The empty state explains whether no results match or no favourites have been saved. Loading more focuses the first newly revealed look; Find selected clears filters, reveals the required page, then focuses and scrolls to the chosen card.

### Fields and text editing

Text fields use raised plum, a thin border, rounded field corners and a minimum height (48px). Active canvas-text rows use amber borders; hidden text rows lower the input opacity. Search uses a deep-plum inset field with an inline SVG search icon, a visible label for assistive technology and an amber caret. Pointer focus changes its border; keyboard focus places the shared outline on its wrapper. Text selection uses amber with dark text.

Tapping canvas words selects them; dragging moves them. A dashed amber selection rectangle and optional center guide are preview-only and never exported. Selected colour swatches add a white border and amber outer ring.

### Workflow cards and video canvas

Numbered cards preserve the existing sequence: song/photo, look, words, optional intro/ending, options, then export. Artwork is generated from the user's photo with canvas drawing primitives; this extension ships no new static raster artwork. Existing icons are inline SVG or the established app icon.

New looks keep audio marks subordinate to the photo and editable titles: bounded bars, fine waveforms, meter needles, tile changes, small orbit changes and ribbons. Time-driven progress or rotation can accompany the audio response. The shared helpers and family modules define actual per-look behaviour. Titles are an independent renderer layer, and optional bottom waves remain available through the existing overlay system.

## Do's and Don'ts

### Do:

- **Do** preserve the familiar single-column editor, sticky preview and numbered workflow.
- **Do** retain original template IDs and saved choices when extending the library.
- **Do** support English and Nepali labels, Devanagari title fallback and readable editable text in every shape.
- **Do** use the user's photo and frame-relative geometry; keep thumbnails faithful to the video composition.
- **Do** preserve visible selection, keyboard focus, independent favourite buttons and progressive browsing.
- **Do** keep canvas audio response restrained, with ornaments and meters inside their reserved areas.

### Don't:

- **Don't** turn a family-specific canvas palette, typeface or ornament into an editor-wide rule.
- **Don't** create another template ID for a recolour or bake fixed song text into artwork.
- **Don't** add network-loaded template assets, runtime package dependencies, per-frame pixel processing or canvas filters.
- **Don't** introduce full-screen strobing or assume a wide layout works unchanged in tall and square outputs.
- **Don't** export editing guides or remove the user's text adjustments when switching looks.

Not canonized: individual canvas colour values and decorative motifs remain local to their compositions. The inherited text-only plus marks in a few action labels are existing copy, not an icon convention for new controls.
