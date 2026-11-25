import { beginEnquiry } from "./enquiries.mjs";
import { endpoint, get, key, workers, hash, increment } from "./common.mjs";
import { visible } from "./listing.mjs";
import { reject } from "./validation.mjs";
export const handler = endpoint(async ({ event, ip }) => {
  if ((await increment("contact#" + hash(ip), 3600)) > 20)
    reject("Contact limit reached. Try again later.", 429);
  const w = await get(workers, key(event.pathParameters.id));
  if (!visible(w)) reject("This listing is unavailable.");
  if (w.whatsapp !== w.phone && !w.contactVerified)
    reject("The worker must verify this work number before contact.");
  return {
    receipt: await beginEnquiry(),
    url: "https://wa.me/" + w.whatsapp.replace(/\D/g, ""),
  };
});
