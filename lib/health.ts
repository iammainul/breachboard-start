export type LivenessBody = {
  status: "ok";
  live: true;
};

export type ReadinessBody = {
  status: "ok" | "unready";
  live: true;
  ready: boolean;
};

export function livenessBody(): LivenessBody {
  return { status: "ok", live: true };
}

export function readinessBody(ready: boolean): ReadinessBody {
  return {
    status: ready ? "ok" : "unready",
    live: true,
    ready,
  };
}

export async function pingDatabase(ping: () => Promise<unknown>): Promise<boolean> {
  try {
    await ping();
    return true;
  } catch {
    return false;
  }
}
