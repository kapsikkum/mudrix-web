export function applyCustomOrder<T>(
  items: T[],
  orderedIds: string[],
  getId: (item: T) => string
): T[] {
  if (orderedIds.length === 0) return items;
  const idSet = new Set(orderedIds);
  const map = new Map(items.map((i) => [getId(i), i]));
  const out: T[] = [];
  for (const id of orderedIds) {
    const item = map.get(id);
    if (item) out.push(item);
  }
  for (const item of items) {
    if (!idSet.has(getId(item))) out.push(item);
  }
  return out;
}
