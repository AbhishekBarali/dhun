// Run with Node 22+: node dev/check-catalog.mjs
import assert from 'node:assert/strict';
import { TEMPLATES, CATEGORIES, templateById } from '../js/templates/index.js';
import { NEW_LOOKS, filterLooks, cleanFavorites } from '../js/look-library.js';

assert.equal(TEMPLATES.length, 80);
assert.equal(NEW_LOOKS.length, 30);
assert.equal(new Set(TEMPLATES.map((look) => look.id)).size, 80);
assert.equal(templateById('missing').id, 'soft-wave', 'The original fallback must stay stable');
assert.equal(TEMPLATES.filter((look) => !look.isNew).length, 50);
for (const look of TEMPLATES) {
  assert.ok(look.name && look.ne && typeof look.draw === 'function', look.id);
  assert.ok(CATEGORIES.some((cat) => cat.id === look.cat), `Missing category for ${look.id}`);
}
for (const look of NEW_LOOKS) {
  assert.ok(look.description && look.descriptionNe && look.tags.length, `Missing discovery metadata for ${look.id}`);
  assert.ok(filterLooks({ query: look.name }).includes(look), `English search: ${look.name}`);
  assert.ok(filterLooks({ query: look.ne }).includes(look), `Nepali search: ${look.ne}`);
}
assert.equal(filterLooks({ collection: 'new' }).length, 30);
assert.equal(filterLooks({ collection: 'new', category: 'nepali' }).length, 5);
assert.equal(filterLooks({ collection: 'new', category: 'retro' }).length, 5);
assert.equal(filterLooks({ collection: 'new', category: 'cinematic' }).length, 5);
assert.equal(filterLooks({ collection: 'new', category: 'simple' }).length, 5);
assert.equal(filterLooks({ collection: 'new', category: 'calm' }).length, 5);
assert.equal(filterLooks({ collection: 'new', category: 'dance' }).length, 3);
assert.equal(filterLooks({ collection: 'new', category: 'hiphop' }).length, 2);
assert.deepEqual(filterLooks({ query: '  RADIO  ', category: 'nepali' }).map((look) => look.id), ['sajha-radio']);
assert.deepEqual(filterLooks({ query: 'साँझको रेडियो' }).map((look) => look.id), ['sajha-radio']);
assert.equal(filterLooks({ query: 'minimal', collection: 'new' }).every((look) => look.isNew), true);
assert.equal(filterLooks({ query: 'no-matching-design-123' }).length, 0);
assert.deepEqual(filterLooks({ collection: 'favorites' }), []);
assert.deepEqual(cleanFavorites(['linen', 'linen', 'removed-look', 'soft-wave']), ['linen', 'soft-wave']);
assert.deepEqual(cleanFavorites({ linen: true }), []);
assert.deepEqual(filterLooks({ collection: 'favorites', favorites: ['soft-wave', 'linen'] }).map((look) => look.id), ['linen', 'soft-wave']);
assert.deepEqual(filterLooks({ collection: 'favorites', favorites: ['soft-wave', 'linen'], query: 'linen', category: 'simple' }).map((look) => look.id), ['linen']);
console.log('Catalogue checks passed: 80 unique looks, 30 additions, categories, multilingual search, combined filters and saved-look migration.');
