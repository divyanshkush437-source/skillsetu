import { build } from "esbuild";
import fs from "node:fs/promises";
const out = process.argv[2] || "SkillSetu-Demo.html";
const { outputFiles } = await build({
  entryPoints: ["src/app.jsx"],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  outdir: "unused",
  define: { "process.env.NODE_ENV": '"production"' },
});
let js = outputFiles.find((f) => f.path.endsWith(".js")).text;
for (const file of ["mark.svg", "toolbox.svg"])
  js = js.replaceAll(
    '"/' + file + '"',
    '"data:image/svg+xml;base64,' +
      (await fs.readFile("public/" + file)).toString("base64") +
      '"',
  );
const css = outputFiles.find((f) => f.path.endsWith(".css")).text;
await fs.writeFile(
  out,
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SkillSetu · Interactive demo</title><style>' +
    css +
    '</style></head><body><div id="root"></div><script>window.SKILLSETU={apiBase:"",portable:true};</script><script>' +
    js.replace(/<\/script/gi, "<\\/script") +
    "</script></body></html>",
);
