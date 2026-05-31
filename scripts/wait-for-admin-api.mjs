#!/usr/bin/env node
/** Block until the local admin API accepts TCP connections (used before starting Vite). */
import net from "node:net";

function parseTarget() {
  const raw = (process.env.VITE_DEV_ADMIN_API_TARGET || "http://127.0.0.1:8787").trim();
  try {
    const url = new URL(raw);
    return {
      host: url.hostname || "127.0.0.1",
      port: Number(url.port) || 8787,
    };
  } catch {
    return { host: "127.0.0.1", port: Number(process.env.PORT) || 8787 };
  }
}

const { host, port } = parseTarget();
const MAX_WAIT_MS = 60_000;
const INTERVAL_MS = 200;

function tryConnect() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

const started = Date.now();
process.stdout.write(`[wait-for-admin] Waiting for admin API at ${host}:${port}...`);

while (Date.now() - started < MAX_WAIT_MS) {
  if (await tryConnect()) {
    process.stdout.write(" ready\n");
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}

process.stdout.write("\n");
console.error(`[wait-for-admin] Timed out after ${MAX_WAIT_MS}ms waiting for ${host}:${port}`);
process.exit(1);
