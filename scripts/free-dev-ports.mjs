#!/usr/bin/env node
/** Free Vite (5173) and admin API (8787) before `npm run dev` to avoid EADDRINUSE. */
import { execSync } from "node:child_process";

const PORTS = [5173, 8787];

for (const port of PORTS) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: "ignore" });
  } catch {
    // Port not in use — nothing to kill.
  }
}
