export const INJECT_SEVERITY_IDS = [
  "watch",
  "elevated",
  "high",
  "critical",
] as const;

export type InjectSeverity = (typeof INJECT_SEVERITY_IDS)[number];

export type InjectSeverityInput = {
  sequence?: number;
  title?: string;
  body?: string;
};

export const INJECT_SEVERITY_TOKENS: Record<
  InjectSeverity,
  { label: string; hex: string; use: string }
> = {
  watch: {
    label: "Watch / intel",
    hex: "#2F6F7E",
    use: "teal status chip and a thin header stripe",
  },
  elevated: {
    label: "Elevated / investigate",
    hex: "#C4A35A",
    use: "amber status chip and the highlighted evidence callout",
  },
  high: {
    label: "High / contain",
    hex: "#C45C3E",
    use: "rust status chip and the containment decision callout",
  },
  critical: {
    label: "Critical / impact",
    hex: "#B42318",
    use: "crimson status chip and one impact banner only — never the whole canvas",
  },
};

const CRITICAL_RE =
  /\b(ransom|leak|exfil|customer impact|outage|wipe|press|media inquiry|board flash|6-hour|six.hour|public disclosure|btc|bitcoin)\b/i;
const HIGH_RE =
  /\b(contain|isolate|confirmed incident|lateral|c2|domain admin|swift|payment|vlan|quarantine|regulator clock)\b/i;
const ELEVATED_RE =
  /\b(investigate|triage|phish|mailbox|suspicious|ioc|beacon|alert|advisory follow.?up)\b/i;
const WATCH_RE =
  /\b(advisory|intel|notification|watch|receipt|tip|bulletin)\b/i;

function sequenceSeverity(sequence: number | undefined): InjectSeverity {
  if (!sequence || sequence <= 1) return "watch";
  if (sequence === 2) return "elevated";
  if (sequence <= 4) return "high";
  return "critical";
}

function keywordSeverity(text: string): InjectSeverity | null {
  if (CRITICAL_RE.test(text)) return "critical";
  if (HIGH_RE.test(text)) return "high";
  if (ELEVATED_RE.test(text)) return "elevated";
  if (WATCH_RE.test(text)) return "watch";
  return null;
}

const RANK: Record<InjectSeverity, number> = {
  watch: 0,
  elevated: 1,
  high: 2,
  critical: 3,
};

/** Pick the stronger of sequence position and inject wording. */
export function inferInjectSeverity(inject: InjectSeverityInput): InjectSeverity {
  const fromSequence = sequenceSeverity(inject.sequence);
  const fromKeywords = keywordSeverity(
    `${inject.title ?? ""} ${inject.body ?? ""}`,
  );
  if (!fromKeywords) return fromSequence;
  return RANK[fromKeywords] >= RANK[fromSequence] ? fromKeywords : fromSequence;
}

export function describeInjectSeverity(severity: InjectSeverity): string {
  const token = INJECT_SEVERITY_TOKENS[severity];
  return `${token.label} (${token.hex}) on ${token.use}`;
}
