import { endpoint, increment, hash, secret } from "./common.mjs";
import { reject } from "./validation.mjs";
import { speechInput, synthesizeSpeech } from "./speech-core.mjs";
let credentials;
export const handler = endpoint(async ({ body, ip }) => {
  const input = speechInput(body);
  if ((await increment("speech#" + hash(ip), 3600)) > 40) reject("Voice limit reached. Try again later.", 429);
  if (!process.env.BHASHINI_PARAMETER) reject("Speech service is not configured.", 503);
  credentials ||= JSON.parse(await secret(process.env.BHASHINI_PARAMETER));
  return synthesizeSpeech(input, credentials);
});
