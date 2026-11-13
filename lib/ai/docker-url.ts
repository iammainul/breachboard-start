import { existsSync } from "node:fs";

let cachedInDocker: boolean | null = null;

export function runningInDocker(): boolean {
  if (cachedInDocker !== null) return cachedInDocker;
  try {
    cachedInDocker = existsSync("/.dockerenv");
  } catch {
    cachedInDocker = false;
  }
  return cachedInDocker;
}

/**
 * Inside Docker, localhost is the container — not the host where Ollama usually runs.
 * Rewrite loopback hosts to host.docker.internal (requires compose extra_hosts).
 */
export function rewriteLoopbackForDocker(url: string | undefined | null): string | undefined {
  const raw = url?.trim();
  if (!raw) return undefined;
  if (!runningInDocker()) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      parsed.hostname = "host.docker.internal";
      // URL.toString() may add trailing slash; keep OpenAI-compatible base clean
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return raw;
  }
  return raw;
}

export function ollamaDockerHint(url: string | undefined | null): string | null {
  const raw = url?.trim();
  if (!raw || !runningInDocker()) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return "Running in Docker: localhost was rewritten to host.docker.internal so Ollama on the host is reachable.";
    }
  } catch {
    return null;
  }
  return null;
}
