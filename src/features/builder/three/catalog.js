import { PARTS } from './model.js';
export function normalizeCatalog(items) {
  if (!Array.isArray(items)) throw new TypeError('catalog must be an array');
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new TypeError('Every catalog item needs a unique nonempty string id');
    if (!Object.hasOwn(PARTS, item.category)) throw new TypeError(`Unknown category: ${item.category}`);
    if (typeof item.name !== 'string' || !item.name.trim()) throw new TypeError('Every item needs a name');
    if (!Number.isInteger(item.stock) || item.stock < 0) throw new TypeError('stock must be a nonnegative integer');
    if (!Number.isFinite(item.price) || item.price < 0) throw new TypeError('price must be a nonnegative number');
    ids.add(item.id); return { ...item };
  });
}
export function reconcileSelection(catalog, selection = {}) {
  const result = {};
  for (const category of Object.keys(PARTS)) {
    const item = catalog.find(i => i.id === selection[category] && i.category === category);
    if (item) result[category] = item.id;
  }
  return result;
}
export function buildSnapshot(catalog, selection) {
  const parts = Object.keys(PARTS).map(category => catalog.find(i=>i.id===selection[category] && i.category===category)).filter(Boolean).map(i=>({...i}));
  return { selection:{...selection}, parts, total:parts.reduce((n,p)=>n+p.price,0), selectedCount:parts.length, complete:parts.length===Object.keys(PARTS).length };
}
