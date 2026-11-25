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
