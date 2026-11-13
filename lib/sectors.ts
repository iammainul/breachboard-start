import { z } from "zod";
import type { FeedSource } from "@prisma/client";

export const SECTORS = [
  {
    id: "bfsi_in",
    label: "BFSI",
    prompt:
      "Indian BFSI: RBI, CERT-In, SEBI, KYC, core banking, SWIFT, customer data.",
    setting: "Indian BFSI: core banking floor, SOC, KYC vaults, SWIFT corridor.",
    audience: "Indian bank SOC, CISO, legal, and crisis comms.",
    regulators: ["RBI", "CERT-In", "SEBI"] as const,
    feeds: ["RBI", "SEBI", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "gov",
    label: "Government",
    prompt:
      "Government / public sector: CERT-In, CISA, citizen data, SCADA/OT, classified systems.",
    setting: "Public-sector SOC, ministry ops, citizen-data systems.",
    audience: "Public-sector SOC, CISO, legal, and crisis comms.",
    regulators: ["CERT-In", "CISA"] as const,
    feeds: ["CERT_IN", "CISA", "FBI"] as const satisfies readonly FeedSource[],
  },
  {
    id: "energy",
    label: "Energy & utilities",
    prompt:
      "Energy and utilities: OT/ICS, grid, generation, pipelines, CISA ICS, CERT-In.",
    setting: "Control room, generation plant, grid ops, OT SOC.",
    audience: "OT/ICS operators, CISO, legal, and crisis comms.",
    regulators: ["CISA", "CERT-In"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    prompt:
      "Healthcare: EHR, clinical systems, PHI, medical devices, ransomware, CERT-In / CISA.",
    setting: "Hospital SOC, EHR floor, clinical imaging, pharmacy systems.",
    audience: "Hospital CISO, clinical ops, legal, and crisis comms.",
    regulators: ["CERT-In", "CISA"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "telecom",
    label: "Telecom",
    prompt:
      "Telecom: core network, BSS/OSS, subscriber data, signaling, CERT-In.",
    setting: "NOC, BSS/OSS, subscriber-data vaults, core network.",
    audience: "Telecom SOC, CISO, legal, and crisis comms.",
    regulators: ["CERT-In", "CISA"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    prompt:
      "Manufacturing: OT/ICS, MES, supply chain, plant floor, CISA ICS.",
    setting: "Plant floor, MES, OT SOC, supply-chain ops.",
    audience: "Plant CISO, OT operators, legal, and crisis comms.",
    regulators: ["CISA", "CERT-In"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "retail",
    label: "Retail & e-commerce",
    prompt:
      "Retail and e-commerce: POS, payment, customer PII, supply chain, CERT-In.",
    setting: "Retail HQ SOC, payments, e-commerce, warehouse ops.",
    audience: "Retail CISO, payments, legal, and crisis comms.",
    regulators: ["CERT-In", "RBI"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "technology",
    label: "Technology",
    prompt:
      "Technology / SaaS: cloud, identity, source repos, customer tenants, CISA.",
    setting: "SaaS SOC, identity plane, cloud control plane, source repos.",
    audience: "SaaS CISO, platform, legal, and crisis comms.",
    regulators: ["CISA", "CERT-In"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "transport",
    label: "Transport & logistics",
    prompt:
      "Transport and logistics: fleet, OT, passenger data, OT/ICS, CERT-In / CISA.",
    setting: "Fleet ops, passenger systems, logistics OT, control rooms.",
    audience: "Transport CISO, ops, legal, and crisis comms.",
    regulators: ["CISA", "CERT-In"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
  {
    id: "education",
    label: "Education",
    prompt:
      "Education: student PII, research networks, identity, ransomware, CERT-In.",
    setting: "Campus SOC, student systems, research networks.",
    audience: "Campus CISO, IT, legal, and crisis comms.",
    regulators: ["CERT-In", "CISA"] as const,
    feeds: ["CISA", "CERT_IN"] as const satisfies readonly FeedSource[],
  },
] as const;

export const SECTOR_IDS = SECTORS.map((s) => s.id) as unknown as [
  (typeof SECTORS)[number]["id"],
  ...(typeof SECTORS)[number]["id"][],
];

export const sectorSchema = z.enum(SECTOR_IDS);
export type SectorId = z.infer<typeof sectorSchema>;

const byId = Object.fromEntries(SECTORS.map((s) => [s.id, s])) as Record<
  SectorId,
  (typeof SECTORS)[number]
>;

export function sectorDef(sector: string | null | undefined) {
  if (sector && sector in byId) return byId[sector as SectorId];
  return byId.bfsi_in;
}

export function sectorLabel(sector: string | null | undefined) {
  return sectorDef(sector).label;
}

export function sectorPrompt(sector: string | null | undefined) {
  return sectorDef(sector).prompt;
}

export function sectorVisual(sector: string | null | undefined) {
  const s = sectorDef(sector);
  return { setting: s.setting, audience: s.audience };
}

export type RegulatorTag = (typeof SECTORS)[number]["regulators"][number];

export function defaultRegulatorTags(sector: string | null | undefined): RegulatorTag[] {
  return [...sectorDef(sector).regulators] as RegulatorTag[];
}

export function feedSourcesForSector(sector: string | null | undefined): FeedSource[] {
  return [...sectorDef(sector).feeds];
}
