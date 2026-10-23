// All looks, grouped by family. Each family file exports an array of templates.
// See docs/templates.md for how to write one.
import simple from './simple.js';
import nepali from './nepali.js';
import hiphop from './hiphop.js';
import dance from './dance.js';
import calm from './calm.js';

export const CATEGORIES = [
  { id: 'all', name: 'All', ne: 'सबै' },
  { id: 'simple', name: 'Simple', ne: 'सजिलो' },
  { id: 'nepali', name: 'Nepali', ne: 'नेपाली' },
  { id: 'hiphop', name: 'Hip-hop & Rap', ne: 'हिप-हप र र्‍याप' },
  { id: 'dance', name: 'Dance & Party', ne: 'डान्स र पार्टी' },
  { id: 'calm', name: 'Calm & Sad', ne: 'शान्त र दुःखी' },
];

export const TEMPLATES = [...simple, ...nepali, ...hiphop, ...dance, ...calm];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
