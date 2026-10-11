// The one Fly volume at /data is the only storage that survives a restart
// or redeploy, so that's where this lives in production; the Dockerfile
// sets DB_PATH accordingly. Locally (outside Docker) it defaults to a
// relative path so `pnpm start` works without extra setup.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { applySchema } from "./schema.ts";

const DB_PATH = process.env.DB_PATH ?? "./data/collective-snake.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");

applySchema(db);
