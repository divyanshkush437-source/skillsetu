// Shared public-directory rules for Lambda and the portable demo.
export function areasOf(worker) {
  return [
    ...new Set(
      [worker.locality, ...(worker.serviceAreas || [])].filter(Boolean),
    ),
  ];
}
export function visible(worker) {
  return Boolean(
    worker && worker.listed !== false && worker.moderation !== "hidden",
  );
}
export function available(worker, time = Date.now()) {
  if (worker.availability !== true) return false;
  const age = time - Date.parse(worker.confirmedAt);
  return age >= 0 && age < 86400000 ? true : null;
}
export function draftMessage(skill, area, task = "", when = "today") {
  return (
    "Hi, I found you on SkillSetu. I need " +
    skill.toLowerCase() +
    " work in " +
    area +
    (task.trim() ? ": " + task.trim() : ".") +
    " Are you available " +
    when +
    "? Please confirm your estimate, including any visit charge."
  );
}
export const reasons = [
  "Incorrect details",
  "Spam or agency listing",
  "Unsafe or abusive contact",
  "Discriminatory behaviour",
  "Other concern",
];
