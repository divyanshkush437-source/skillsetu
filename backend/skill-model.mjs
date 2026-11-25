// Rank training examples by TF-IDF cosine similarity. Weak or tied matches
// leave the skill selection to the household.
const stopWords = new Set(
  "a an the to at my our your for from is are in on up of and or with need someone help please ka ki ke ko mein se hai hain ho liye karna karni karne chahiye gaya hai kaam madad par hai का की के को में से है हैं पर लिए करना करनी चाहिए मदद".split(
    /\s+/,
  ),
);
export function words(text) {
  return [
    ...new Set(
      (
        text
          .normalize("NFKC")
          .toLowerCase()
          .match(/[\p{L}\p{M}\p{N}]+/gu) || []
      ).filter((t) => !stopWords.has(t)),
    ),
  ];
}
export function train(examples) {
  const rows = [],
    counts = new Map();
  for (const [skill, texts] of Object.entries(examples)) {
    for (const text of texts) {
      const tokens = words(text);
      rows.push({ skill, tokens });
      for (const token of tokens)
        counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  const weights = Object.fromEntries(
    [...counts].map(([token, n]) => [
      token,
      1 + Math.log((1 + rows.length) / (1 + n)),
    ]),
  );
  return {
    weights,
    rows: rows.map((row) => ({
      ...row,
      norm: Math.hypot(...row.tokens.map((t) => weights[t])),
    })),
  };
}
export function predict(model, text) {
  const query = new Set(
    words(text).filter((t) => Object.hasOwn(model.weights, t)),
  );
  const norm = Math.hypot(...[...query].map((t) => model.weights[t]));
  if (!norm) return null;
  const scores = new Map();
  for (const row of model.rows) {
    const shared = row.tokens.filter((t) => query.has(t));
    const score =
      shared.reduce((sum, t) => sum + model.weights[t] ** 2, 0) /
      (norm * row.norm);
    scores.set(row.skill, Math.max(scores.get(row.skill) || 0, score));
  }
  const [first, second] = [...scores].sort((a, b) => b[1] - a[1]);
  return first && first[1] >= 0.42 && first[1] - (second?.[1] || 0) >= 0.12
    ? first[0]
    : null;
}
