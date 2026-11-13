export { feedSourcesForSector } from "@/lib/sectors";

export function advisoryWindowStart(months = 24): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

export function formatFeedSource(source: string, publisher?: string | null) {
  if (publisher?.trim()) return publisher.trim();
  if (source === "CERT_IN") return "CERT-In";
  if (source === "NEWS") return "Cyber news";
  return source;
}
