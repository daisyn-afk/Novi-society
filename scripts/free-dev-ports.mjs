#!/usr/bin/env node
/** Free Vite (5173) and admin API (8787) before `npm run dev` to avoid EADaDRINUSE. */
import { execSync } from "node:child_process";

const PORTS = [5173, 8787];

function freePort(port) {
  try {
    if (process.platform === "darwin") {
      const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
      if (!pids) return;
      for (const pid of pids.split("\n")) {
        execSync(`kill ${pid}`, { stdio: "ignore" });
      }
      return;
    }
    execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: "ignore" });
  } catch {
    // Port not in use — nothing to kill.
  }
}

for (const port of PORTS) {
  freePort(port);
}
