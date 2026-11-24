import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
const root = path.resolve("dist");
http
  .createServer(async (req, res) => {
    try {
      let url = new URL(req.url, "http://localhost").pathname;
      let file = path.resolve(
        root,
        "." + (path.extname(url) ? url : "/index.html"),
      );
      if (!file.startsWith(root + "/")) throw Error();
      const data = await readFile(file);
      res.setHeader(
        "Content-Type",
        {
          ".js": "text/javascript",
          ".css": "text/css",
          ".html": "text/html; charset=utf-8",
          ".svg": "image/svg+xml",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
    console.log(
      "SkillSetu ready on http://127.0.0.1:" + (process.env.PORT || 4173),
    ),
  );
