import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { renderMarkdown } from "./markdown.ts";
import { serveStatic } from "./static.ts";
import { getSummary } from "./db/repo.ts";
import { attachWebSocketServer } from "./ws.ts";
import { startGameLoop } from "./game/loop.ts";

const PORT = Number(process.env.PORT ?? 8080);

function renderReadmePage(): string {
  const markdown = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const body = renderMarkdown(markdown);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Collective Snake — README</title></head>
<body>${body}</body>
</html>`;
}

// Rendered once at startup: README.md only changes between deploys, not
// between requests.
const readmeHtml = renderReadmePage();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://internal");

  if (url.pathname === "/readme" || url.pathname === "/readme/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readmeHtml);
    return;
  }

  if (url.pathname === "/api/summary") {
    const token = url.searchParams.get("token");
    const summary = getSummary(token);
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(summary));
    return;
  }

  if (url.pathname === "/") {
    void serveStatic(res, "/index.html").then((served) => {
      if (!served) {
        res.writeHead(404);
        res.end("not found");
      }
    });
    return;
  }

  void serveStatic(res, url.pathname).then((served) => {
    if (!served) {
      res.writeHead(404);
      res.end("not found");
    }
  });
});

attachWebSocketServer(server);
startGameLoop();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Collective Snake listening on 0.0.0.0:${PORT}`);
});
