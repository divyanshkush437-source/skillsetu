import config from "../backend/config.json";
export { config };
export const live = Boolean(window.SKILLSETU.apiBase);
export const samples = [
  [
    "demo-001",
    "Ramesh Kumar",
    "Plumber",
    "Andheri West",
    "5+ years",
    "₹500–1000/hr",
    true,
    "919876543210",
    "1 hour ago",
    24,
    "2026-11-08",
  ],
  [
    "demo-002",
    "Suresh Electricals",
    "Electrician",
    "Bandra East",
    "3–5 years",
    "₹400–800/hr",
    true,
    "919876543211",
    "30 mins ago",
    18,
    "2026-11-15",
  ],
  [
    "demo-003",
    "Priya Home Services",
    "Maid/Housekeeping",
    "Powai",
    "3–5 years",
    "₹200–400/hr",
    false,
    "919876543212",
    "3 hours ago",
    31,
    "2026-11-20",
  ],
  [
    "demo-004",
    "Imran Plumbing Works",
    "Plumber",
    "Andheri East",
    "3–5 years",
    "₹200–500/hr",
    true,
    "919876543213",
    "2 hours ago",
    9,
    "2026-11-22",
  ],
].map(
  ([
    id,
    name,
    skill,
    locality,
    experience,
    priceRange,
    availability,
    whatsapp,
    lastSeen,
    contacts,
    createdAt,
  ]) => ({
    id,
    name,
    skill,
    locality,
    experience,
    priceRange,
    availability,
    lastSeen,
    contacts,
    createdAt,
    verified: true,
    whatsappLink: wa(whatsapp, skill, locality),
  }),
);
// Same wording as waMessage in backend/validation.mjs.
export function waMessage(skill, locality) {
  return (
    "Hi, I found you on SkillSetu. I need a " +
    skill.toLowerCase() +
    " in " +
    locality +
    ". Are you available today?"
  );
}
export function wa(phone, skill, locality) {
  let number = phone.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(number)) number = "91" + number;
  return (
    "https://wa.me/" +
    number +
    "?text=" +
    encodeURIComponent(waMessage(skill, locality))
  );
}
export function nearbyAreas(locality) {
  return config.nearby[locality] || [];
}
export function since(value) {
  if (!value) return "Recently joined";
  return (
    "On SkillSetu since " +
    new Date(value).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    })
  );
}
export function read(k, f) {
  try {
    return JSON.parse(localStorage.getItem("ss-" + k)) ?? f;
  } catch {
    return f;
  }
}
export function save(k, v) {
  localStorage.setItem("ss-" + k, JSON.stringify(v));
}
export const portable = Boolean(window.SKILLSETU.portable);
export function route() {
  return portable
    ? new URL(location.hash.slice(1) || "/", "https://demo.invalid")
    : location;
}
export function navigate(path) {
  if (portable) {
    location.hash = path;
    window.dispatchEvent(new Event("popstate"));
    window.scrollTo(0, 0);
    return;
  }
  history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo(0, 0);
}
export async function api(
  path,
  { method = "GET", body, user, signal, captcha } = {},
) {
  const token = user && (await user.getIdToken());
  const res = await fetch(window.SKILLSETU.apiBase + path, {
    method,
    signal,
    headers: {
      ...(captcha ? { "X-Captcha-Token": captcha } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success)
    throw Error(json.error || "Request failed. Please try again.");
  return json.data;
}
export function activity(value) {
  if (!value) return "Activity unknown";
  if (!/^\d{4}-/.test(value)) return "Active " + value;
  const mins = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60000),
  );
  return mins < 1
    ? "Active just now"
    : mins < 60
      ? "Active " + mins + " min ago"
      : mins < 1440
        ? "Active " + Math.floor(mins / 60) + " hr ago"
        : "Active " + Math.floor(mins / 1440) + " days ago";
}
