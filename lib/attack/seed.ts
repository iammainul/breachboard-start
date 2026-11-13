import { prisma } from "@/lib/prisma";

const tactics = [
  { id: "TA0001", name: "Initial Access", shortname: "initial-access" },
  { id: "TA0002", name: "Execution", shortname: "execution" },
  { id: "TA0003", name: "Persistence", shortname: "persistence" },
  { id: "TA0004", name: "Privilege Escalation", shortname: "privilege-escalation" },
  { id: "TA0005", name: "Defense Evasion", shortname: "defense-evasion" },
  { id: "TA0006", name: "Credential Access", shortname: "credential-access" },
  { id: "TA0007", name: "Discovery", shortname: "discovery" },
  { id: "TA0008", name: "Lateral Movement", shortname: "lateral-movement" },
  { id: "TA0009", name: "Collection", shortname: "collection" },
  { id: "TA0011", name: "Command and Control", shortname: "command-and-control" },
  { id: "TA0010", name: "Exfiltration", shortname: "exfiltration" },
  { id: "TA0040", name: "Impact", shortname: "impact" },
];

const techniques = [
  { id: "T1566", name: "Phishing", tacticId: "TA0001", description: "Adversaries send phishing messages to gain access." },
  { id: "T1190", name: "Exploit Public-Facing Application", tacticId: "TA0001", description: "Exploitation of internet-facing apps or VPNs." },
  { id: "T1078", name: "Valid Accounts", tacticId: "TA0001", description: "Use of stolen or valid credentials." },
  { id: "T1059", name: "Command and Scripting Interpreter", tacticId: "TA0002", description: "PowerShell, bash, or other interpreters." },
  { id: "T1053", name: "Scheduled Task/Job", tacticId: "TA0003", description: "Persistence via scheduled tasks." },
  { id: "T1547", name: "Boot or Logon Autostart Execution", tacticId: "TA0003", description: "Autostart persistence." },
  { id: "T1036", name: "Masquerading", tacticId: "TA0005", description: "Disguise malware as legitimate files or processes." },
  { id: "T1562", name: "Impair Defenses", tacticId: "TA0005", description: "Disable or impair security tools." },
  { id: "T1003", name: "OS Credential Dumping", tacticId: "TA0006", description: "Dump credentials from OS or LSASS." },
  { id: "T1021", name: "Remote Services", tacticId: "TA0008", description: "Move laterally via RDP, SMB, SSH, WinRM." },
  { id: "T1048", name: "Exfiltration Over Alternative Protocol", tacticId: "TA0010", description: "Exfil over non-C2 protocols." },
  { id: "T1567", name: "Exfiltration Over Web Service", tacticId: "TA0010", description: "Exfil to cloud or web services." },
  { id: "T1486", name: "Data Encrypted for Impact", tacticId: "TA0040", description: "Ransomware encryption of data." },
  { id: "T1490", name: "Inhibit System Recovery", tacticId: "TA0040", description: "Delete backups, shadow copies, or recovery." },
  { id: "T1489", name: "Service Stop", tacticId: "TA0040", description: "Stop services to aid impact." },
  { id: "T1071", name: "Application Layer Protocol", tacticId: "TA0011", description: "C2 over HTTP/S, DNS, or other app protocols." },
];

const groups = [
  {
    id: "G0016",
    name: "APT29",
    aliases: ["Cozy Bear", "Midnight Blizzard"],
    description: "Russian SVR-attributed group known for stealthy credential and cloud operations.",
    techniques: ["T1566", "T1078", "T1059", "T1003", "T1071"],
  },
  {
    id: "G0032",
    name: "Lazarus Group",
    aliases: ["HIDDEN COBRA"],
    description: "DPRK-attributed group targeting financial and crypto sectors.",
    techniques: ["T1566", "T1190", "T1059", "T1486", "T1567"],
  },
  {
    id: "G0007",
    name: "APT28",
    aliases: ["Fancy Bear", "Forest Blizzard"],
    description: "GRU-attributed group conducting espionage against government and critical sectors.",
    techniques: ["T1566", "T1190", "T1059", "T1021", "T1048"],
  },
  {
    id: "G0140",
    name: "Wizard Spider",
    aliases: ["UNC1878"],
    description: "eCrime actor historically associated with TrickBot, Ryuk, and Conti-style ransomware.",
    techniques: ["T1566", "T1078", "T1021", "T1486", "T1490", "T1489"],
  },
  {
    id: "G0096",
    name: "APT41",
    aliases: ["Wicked Panda"],
    description: "Dual espionage and financially motivated actor.",
    techniques: ["T1190", "T1059", "T1078", "T1021", "T1567"],
  },
];

export async function seedMinimalAttack() {
  for (const tactic of tactics) {
    await prisma.attackTactic.upsert({
      where: { id: tactic.id },
      create: { ...tactic, description: tactic.name },
      update: { name: tactic.name, shortname: tactic.shortname },
    });
  }
  for (const tech of techniques) {
    await prisma.attackTechnique.upsert({
      where: { id: tech.id },
      create: tech,
      update: {
        name: tech.name,
        description: tech.description,
        tacticId: tech.tacticId,
      },
    });
  }
  for (const group of groups) {
    await prisma.attackGroup.upsert({
      where: { id: group.id },
      create: {
        id: group.id,
        name: group.name,
        aliases: group.aliases,
        description: group.description,
      },
      update: {
        name: group.name,
        aliases: group.aliases,
        description: group.description,
      },
    });
    for (const techniqueId of group.techniques) {
      await prisma.attackGroupTechnique.upsert({
        where: { groupId_techniqueId: { groupId: group.id, techniqueId } },
        create: { groupId: group.id, techniqueId },
        update: {},
      });
    }
  }

  const playbooks = [
    { techniqueId: "T1566", name: "Phishing mail cluster", logSource: "Email gateway", alertName: "Suspicious attachment / lookalike domain" },
    { techniqueId: "T1486", name: "Mass encryption", logSource: "EDR / file integrity", alertName: "Ransomware note / high entropy writes" },
    { techniqueId: "T1490", name: "Shadow copy deletion", logSource: "Windows Security / Sysmon", alertName: "vssadmin delete shadows" },
    { techniqueId: "T1078", name: "Impossible travel / MFA fatigue", logSource: "IdP / VPN", alertName: "Anomalous successful login" },
  ];
  for (const pb of playbooks) {
    const exists = await prisma.detectionPlaybook.findFirst({
      where: { techniqueId: pb.techniqueId, name: pb.name },
    });
    if (!exists) {
      await prisma.detectionPlaybook.create({
        data: { ...pb, description: pb.alertName },
      });
    }
  }

  return { tactics: tactics.length, techniques: techniques.length, groups: groups.length };
}
