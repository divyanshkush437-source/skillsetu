import { areasOf } from "./listing.mjs";
// A count describes listings in a locality. It does not imply travel coverage.
export function localityCounts(rows, { skill, exclude, available = false }) {
  const counts = new Map();
  for (const row of rows) {
    if ((skill && row.skill !== skill) || (available && !row.availability))
      continue;
    for (const area of areasOf(row))
      if (area !== exclude) counts.set(area, (counts.get(area) || 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([locality, count]) => ({ locality, count }));
}
