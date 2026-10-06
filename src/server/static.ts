// Serves files out of public/ (hand-written assets) and dist/ (the
// compiled client), in that order. Both are relative to the process's
// working directory, which the Dockerfile sets to the app root.

import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import type { ServerResponse } from "node:http";

const ROOTS = ["public", "dist"];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// Strips any leading ".." segments so a request can't escape the root it's
// being served from.
function safeRelativePath(pathname: string): string {
  const normalised = normalize(pathname).replace(/^[/\\]+/, "");
  const parts = normalised.split(sep).filter((part) => part !== "..");
  return parts.join(sep);
}

export async function serveStatic(res: ServerResponse, pathname: string): Promise<boolean> {
  const relative = safeRelativePath(pathname);
  if (relative === "") return false;

  for (const root of ROOTS) {
    try {
      const filePath = join(process.cwd(), root, relative);
      const body = await readFile(filePath);
      const type = MIME[extname(filePath)] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(body);
      return true;
    } catch {
      // not under this root — try the next one, or fall through to 404
    }
  }
  return false;
}
