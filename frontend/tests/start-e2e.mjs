import { cpSync } from "node:fs";

// Match the production Docker image's standalone asset layout.
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
await import("../.next/standalone/server.js");
