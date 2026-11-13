/** Best-effort client identity for rate limits. First X-Forwarded-For hop. */
export function clientIp(request: { headers: { get(name: string): string | null } }) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const real = request.headers.get("x-real-ip") ?? "";
  return forwarded.split(",")[0]?.trim() || real.trim() || "unknown";
}
