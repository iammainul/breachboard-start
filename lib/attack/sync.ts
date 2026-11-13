import { prisma } from "@/lib/prisma";

const STIX_URL =
  "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json";

type StixObject = {
  id: string;
  type: string;
  name?: string;
  description?: string;
  aliases?: string[];
  x_mitre_shortname?: string;
  x_mitre_deprecated?: boolean;
  revoked?: boolean;
  x_mitre_is_subtechnique?: boolean;
  kill_chain_phases?: { kill_chain_name: string; phase_name: string }[];
  external_references?: { source_name: string; external_id?: string }[];
  relationship_type?: string;
  source_ref?: string;
  target_ref?: string;
};

function attackId(obj: StixObject) {
  return obj.external_references?.find((r) => r.source_name === "mitre-attack")
    ?.external_id;
}

export async function syncEnterpriseAttack() {
  const response = await fetch(STIX_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download ATT&CK STIX (${response.status})`);
  }
  const bundle = (await response.json()) as { objects: StixObject[] };
  const objects = bundle.objects ?? [];

  const tactics = objects.filter(
    (o) => o.type === "x-mitre-tactic" && !o.revoked && !o.x_mitre_deprecated,
  );
  const techniques = objects.filter(
    (o) => o.type === "attack-pattern" && !o.revoked && !o.x_mitre_deprecated,
  );
  const groups = objects.filter(
    (o) => o.type === "intrusion-set" && !o.revoked && !o.x_mitre_deprecated,
  );
  const relationships = objects.filter(
    (o) => o.type === "relationship" && o.relationship_type === "uses",
  );

  const tacticByShortname = new Map<string, string>();
  for (const tactic of tactics) {
    const id = attackId(tactic);
    if (!id || !tactic.name) continue;
    await prisma.attackTactic.upsert({
      where: { id },
      create: {
        id,
        name: tactic.name,
        shortname: tactic.x_mitre_shortname ?? id,
        description: tactic.description ?? "",
      },
      update: {
        name: tactic.name,
        shortname: tactic.x_mitre_shortname ?? id,
        description: tactic.description ?? "",
      },
    });
    if (tactic.x_mitre_shortname) {
      tacticByShortname.set(tactic.x_mitre_shortname, id);
    }
  }

  const stixToTechnique = new Map<string, string>();
  for (const tech of techniques) {
    const id = attackId(tech);
    if (!id || !tech.name) continue;
    const phase = tech.kill_chain_phases?.find(
      (p) => p.kill_chain_name === "mitre-attack",
    )?.phase_name;
    const tacticId = phase ? tacticByShortname.get(phase) : undefined;
    await prisma.attackTechnique.upsert({
      where: { id },
      create: {
        id,
        name: tech.name,
        description: tech.description ?? "",
        tacticId: tacticId ?? null,
        isSubtechnique: Boolean(tech.x_mitre_is_subtechnique),
      },
      update: {
        name: tech.name,
        description: tech.description ?? "",
        tacticId: tacticId ?? null,
        isSubtechnique: Boolean(tech.x_mitre_is_subtechnique),
      },
    });
    stixToTechnique.set(tech.id, id);
  }

  const stixToGroup = new Map<string, string>();
  for (const group of groups) {
    const id = attackId(group);
    if (!id || !group.name) continue;
    await prisma.attackGroup.upsert({
      where: { id },
      create: {
        id,
        name: group.name,
        aliases: group.aliases ?? [],
        description: group.description ?? "",
      },
      update: {
        name: group.name,
        aliases: group.aliases ?? [],
        description: group.description ?? "",
      },
    });
    stixToGroup.set(group.id, id);
  }

  let links = 0;
  for (const rel of relationships) {
    if (!rel.source_ref || !rel.target_ref) continue;
    const groupId = stixToGroup.get(rel.source_ref);
    const techniqueId = stixToTechnique.get(rel.target_ref);
    if (!groupId || !techniqueId) continue;
    await prisma.attackGroupTechnique.upsert({
      where: {
        groupId_techniqueId: { groupId, techniqueId },
      },
      create: { groupId, techniqueId },
      update: {},
    });
    links += 1;
  }

  return {
    tactics: tactics.length,
    techniques: techniques.length,
    groups: groups.length,
    links,
  };
}
