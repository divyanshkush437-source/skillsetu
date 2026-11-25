import { visible } from "./listing.mjs";
import { endpoint, get, workers, key } from "./common.mjs";
import { publicWorker, reject } from "./validation.mjs";
export const handler = endpoint(async ({ event }) => {
  const w = await get(workers, key(event.pathParameters.id));
  if (!visible(w)) reject("Worker profile not found.");
  return publicWorker(w);
});
