// Keep each provider request below the server's 300-character limit.
export function speechChunks(message, limit = 240) {
  const chunks = [];
  let rest = message.trim();
  while (rest.length > limit) {
    let split = rest.lastIndexOf(" ", limit);
    if (split < limit / 2) split = limit;
    chunks.push(rest.slice(0, split).trim());
    rest = rest.slice(split).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export async function findBrowserVoice(synth, language) {
  if (!synth) return null;
  const match = () => synth.getVoices().find(voice =>
    voice.lang.toLowerCase().split(/[-_]/)[0] === language
  ) || null;
  const ready = match();
  if (ready) return ready;
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", changed);
      resolve(match());
    };
    const changed = () => { if (match()) finish(); };
    const timer = setTimeout(finish, 1500);
    synth.addEventListener("voiceschanged", changed);
    changed();
  });
}
