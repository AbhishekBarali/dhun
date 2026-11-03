// Shared by the picker, developer gallery and catalogue tests.
import { TEMPLATES, CATEGORIES } from './templates/index.js';

export const NEW_LOOKS = TEMPLATES.filter((look) => look.isNew);
export const PAGE_SIZE = 12;

export function cleanFavorites(ids) {
  return Array.isArray(ids) ? [...new Set(ids)].filter((id) => TEMPLATES.some((look) => look.id === id)) : [];
}

function searchText(look) {
  const cat = CATEGORIES.find((category) => category.id === look.cat);
  return [look.id.replaceAll('-', ' '), look.name, look.ne, look.description, look.descriptionNe,
    ...(look.tags || []), cat?.name, cat?.ne].filter(Boolean).join(' ').normalize('NFC').toLocaleLowerCase();
}
const searchable = new Map(TEMPLATES.map((look) => [look.id, searchText(look)]));

export function filterLooks({ category = 'all', collection = 'all', query = '', favorites = [] } = {}) {
  const terms = query.trim().normalize('NFC').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const saved = new Set(favorites);
  return TEMPLATES.filter((look) =>
    (category === 'all' || look.cat === category) &&
    (collection !== 'new' || look.isNew) &&
    (collection !== 'favorites' || saved.has(look.id)) &&
    terms.every((term) => searchable.get(look.id).includes(term))
  ).sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
}
