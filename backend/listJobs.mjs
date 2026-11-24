import { endpoint, get, key, workers, jobs, byTrade, now } from "./common.mjs";
export const handler = endpoint(async ({ user }) => {
  const w = await get(workers, key(user.uid));
  if (!w) return [];
  return (await byTrade(jobs, w.skill, w.locality))
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
