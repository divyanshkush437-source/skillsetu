import { endpoint, increment, hash } from "./common.mjs";
import { phone, reject } from "./validation.mjs";
export const handler = endpoint(async ({ body }) => {
  if ((await increment("otp#" + hash(phone(body.phone)), 3600)) > 3)
    reject("Too many attempts. Try again in 1 hour.", 429);
  return { permitted: true };
});
