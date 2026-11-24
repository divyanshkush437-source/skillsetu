import { build } from "esbuild";
import { cp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
if (process.env.SKILL_API_BASE) {
  const firebase = JSON.parse(
    await readFile(process.env.FIREBASE_CONFIG, "utf8"),
  );
  await writeFile(
    "dist/config.js",
    "window.SKILLSETU=" +
      JSON.stringify({
        apiBase: process.env.SKILL_API_BASE,
        firebase,
        turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "",
      }) +
      ";",
  );
}
await build({
  entryPoints: ["src/app.jsx"],
  outdir: "dist/assets",
  bundle: true,
  minify: true,
  splitting: true,
  format: "esm",
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' },
});
const files = [
  "/",
  "/index.html",
  "/config.js",
  "/toolbox.svg",
  "/mark.svg",
  ...(await readdir("dist/assets")).map((x) => "/assets/" + x),
];
const hash = createHash("sha256");
for (const f of files.slice(1)) hash.update(await readFile("dist" + f));
const key = "skillsetu-" + hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const key=${JSON.stringify(key)};self.oninstall=e=>e.waitUntil(caches.open(key).then(c=>c.addAll(${JSON.stringify(files)})).then(()=>self.skipWaiting()));self.onactivate=e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('skillsetu-')&&k!==key).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));self.onfetch=e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html')));else if(${JSON.stringify(files)}.includes(new URL(e.request.url).pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))}`,
);
