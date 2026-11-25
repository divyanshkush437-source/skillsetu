import { areasOf, visible } from "./listing.mjs";
import { endpoint, get, key, workers, jobs, byTrade, now } from "./common.mjs";
export const handler = endpoint(async ({ user }) => {
  const w = await get(workers, key(user.uid));
  if (!visible(w)) return [];
  return (await Promise.all(areasOf(w).map((a) => byTrade(jobs, w.skill, a))))
    .flat()
    .filter((j) => j.expiresAt > now())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, description, locality, posterPhone, createdAt }) => ({
      id,
      description,
      locality,
      posterPhone,
      createdAt,
    }));
}, true);
