/**
 * Demo seed: fictional Northline Bank phishing → ransomware + regulatory TTX.
 * Run: npx tsx scripts/seed-demo.ts
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import type { ExerciseDocument } from "../lib/schema/exercise";
import { parseExerciseDocument } from "../lib/schema/exercise";
import { writeStageCardFile } from "../lib/media/stage-card";

const DEMO_PASSWORD = "Demo@Tabletop1";
const JOIN_CODE = "DEMO01";
const ORG_NAME = "Northline Bank";
const ORG_SLUG = "northline-bank";
/** Public tree does not remap earlier local orgs. */
const LEGACY_SLUGS = [] as const;
const LEGACY_JOIN_CODES = [] as const;
const LEGACY_EMAIL_DOMAINS = [] as const;

async function attachStageMedia(
  exerciseId: string,
  document: ExerciseDocument,
): Promise<ExerciseDocument> {
  const next = structuredClone(document);
  for (const inject of next.injects) {
    const assetPath = await writeStageCardFile({
      exerciseId,
      injectId: inject.id,
      sequence: inject.sequence,
      title: inject.title,
      subtitle: inject.body.split("\n")[0] ?? inject.title,
      footer: "TABLETOP EXERCISE",
    });
    inject.mediaPrompts = [
      {
        kind: "image",
        prompt: `Stage visual for ${inject.title}`,
        aspect: "16:9",
        assetPath,
        source: "fallback",
      },
    ];
    inject.activeTeamIds = [];
  }
  return next;
}

const CISA_SCORE_PREAMBLE = `Score using CISA tabletop exercise principles (discussion-based, no-fault):
(1) Decision quality & timing under uncertainty
(2) Cross-functional coordination / information sharing
(3) Containment & evidence preservation before restoration
(4) External notification readiness (CERT-In / RBI / customers / media as applicable)
(5) Clear ownership and next actions
Reward sound judgment even if wording differs from the expected action.`;

const doc: ExerciseDocument = {
  title:
    "Operation PhishGate: Phishing to Ransomware & Regulatory Response",
  durationMin: 90,
  objectives: [
    "Validate phishing triage through initial access containment",
    "Exercise EDR-disable and lateral-movement decision rights",
    "Practice escalation, exfiltration assessment, and ransomware crisis posture",
    "Rehearse public-issue handling and RBI / CERT-In regulatory response",
  ],
  sector: "bfsi_in",
  regulatorTags: ["RBI", "CERT-In", "CISA"],
  clientProfile: {
    orgType: "Private sector bank ({{org}})",
    criticalAssets: [
      "Core banking",
      "Internet banking portal",
      "AD / identity",
      "SWIFT gateway",
      "Customer KYC vault",
    ],
    stackNotes:
      "On-prem AD, Crowdstrike EDR, Splunk SIEM, hybrid M365, SWIFT jump hosts",
  },
  intelCitations: {
    cveIds: [],
    groupIds: ["G0032"],
    advisories: [
      {
        title: "CISA StopRansomware / phishing-to-ransomware advisory pattern",
        url: "https://www.cisa.gov/stopransomware",
      },
    ],
  },
  attackMap: {
    groupId: "G0032",
    groupName: "Lazarus Group",
    techniques: [
      { id: "T1566.001", name: "Spearphishing Attachment", tactic: "Initial Access" },
      { id: "T1204.002", name: "Malicious File", tactic: "Execution" },
      { id: "T1562.001", name: "Disable or Modify Tools", tactic: "Defense Evasion" },
      { id: "T1021.002", name: "SMB/Windows Admin Shares", tactic: "Lateral Movement" },
      { id: "T1078", name: "Valid Accounts", tactic: "Privilege Escalation" },
      { id: "T1048", name: "Exfiltration Over Alternative Protocol", tactic: "Exfiltration" },
      { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact" },
    ],
  },
  detectionPlaybooks: [
    {
      techniqueId: "T1566.001",
      name: "Phish attachment detonation",
      logSource: "Email gateway / EDR",
      alertName: "Suspicious Office macro from external sender",
      expectedDetection: "Sandbox detonation + user-reported phish",
    },
    {
      techniqueId: "T1562.001",
      name: "EDR sensor tamper",
      logSource: "EDR console",
      alertName: "Sensor service stop / uninstall attempt",
      expectedDetection: "EDR heartbeat loss on finance workstation",
    },
    {
      techniqueId: "T1021.002",
      name: "Admin share lateral hop",
      logSource: "Windows Security / SIEM",
      alertName: "Unusual admin$ access from finance VLAN",
      expectedDetection: "SMB lateral from phished host to file server",
    },
    {
      techniqueId: "T1048",
      name: "Bulk outbound to rare destination",
      logSource: "Proxy / NDR",
      alertName: "Large encrypted upload to rare ASN",
      expectedDetection: "KYC share egress spike",
    },
    {
      techniqueId: "T1486",
      name: "Mass encryption",
      logSource: "EDR / File server",
      alertName: "Mass file rename / ransom note drop",
      expectedDetection: "Encryption burst on file shares + ransom note",
    },
  ],
  roles: [
    {
      id: "ciso",
      name: "CISO",
      description: "Owns cyber decision rights and executive escalation",
      expectedDecisions: ["Invoke IR / crisis cell", "Containment vs continuity"],
    },
    {
      id: "soc",
      name: "SOC Lead",
      description: "Detection, triage, and technical containment",
      expectedDecisions: ["Isolate host/segment", "Preserve EDR timeline"],
    },
    {
      id: "itops",
      name: "IT Operations",
      description: "Identity, endpoints, and restoration readiness",
      expectedDecisions: ["Credential reset scope", "Backup integrity check"],
    },
    {
      id: "legal",
      name: "Legal / Compliance",
      description: "CERT-In / RBI clocks and disclosure posture",
      expectedDecisions: ["Reportability assessment", "Regulator draft"],
    },
    {
      id: "comms",
      name: "Corporate Communications",
      description: "Public narrative, media, and customer messaging",
      expectedDecisions: ["Holding statement", "Spokesperson alignment"],
    },
    {
      id: "biz",
      name: "Business Continuity Owner",
      description: "Channel / payment continuity and customer impact",
      expectedDecisions: ["Service degrade options", "Priority restoration"],
    },
  ],
  teamDefinitions: [
    {
      id: "blue",
      name: "Blue Cell · Cyber Response",
      description: "CISO, SOC, IT Ops",
    },
    {
      id: "gold",
      name: "Gold Cell · Crisis & Regulators",
      description: "Legal, Comms, Business",
    },
  ],
  modules: [
    {
      id: "m-pre",
      name: "Pre-incident / Initial access",
      narrative:
        "A finance staffer opens a spearphish that looks like an RBI circular. Initial foothold establishes on a {{org}} finance workstation.",
      discussionQuestions: [
        "Who owns phishing triage after hours?",
        "When does a single host become a bank-wide incident?",
      ],
    },
    {
      id: "m-resp",
      name: "Response / Expansion",
      narrative:
        "EDR is tampered, lateral movement reaches file servers, privileges escalate, and KYC data begins to leave the network.",
      discussionQuestions: [
        "Contain first or observe for intel?",
        "What evidence must be preserved before rebuild?",
      ],
    },
    {
      id: "m-rec",
      name: "Impact / Public & regulatory",
      narrative:
        "Ransomware hits shares; social posts claim {{org}} customer data leak; RBI and CERT-In clocks start.",
      discussionQuestions: [
        "Pay / negotiate / refuse?",
        "What do you tell customers before forensics is complete?",
      ],
    },
  ],
  injects: [
    {
      id: "inj-01",
      sequence: 1,
      title: "Phishing alert — finance workstation compromised",
      body: `NOTIFICATION · 08:12 IST
Email security + Crowdstrike fire together:
• External sender spoofed as "rbi-circulars@secure-notify[.]in" with attachment "RBI_Cyber_Circular_Q3.docm"
• Finance RM (Mumbai) enabled macros; beacon observed to rare C2
• Host: NL-FIN-WS-441 still on corporate VLAN; user still logged in

Direction given for this exercise: treat this as the start of a directed phishing-to-ransomware campaign against {{org}}.`,
      timerSeconds: 300,
      targetRoleIds: ["ciso", "soc", "itops", "legal"],
      techniqueIds: ["T1566.001", "T1204.002"],
      activeTeamIds: ["blue", "gold"],
      questions: [
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt:
            "What immediate containment actions do you take on NL-FIN-WS-441, and what evidence do you freeze first?",
          expectedAction:
            "Network isolate / EDR contain host; snapshot + EDR timeline + mailbox quarantine; do not power-off blindly",
          points: 5,
        },
        {
          roleId: "ciso",
          roleIds: ["ciso"],
          common: false,
          prompt:
            "Do you declare an incident / stand up the crisis cell now, or wait for confirmed malware family?",
          expectedAction:
            "Declare incident now; stand up IR cell; notify CEO/COO flash within 15–30m",
          points: 5,
        },
        {
          roleId: "itops",
          roleIds: ["itops"],
          common: false,
          prompt:
            "What identity actions do you take for the phished user and related privileged accounts?",
          expectedAction:
            "Force password/session revoke for user; check MFA; hunt for new local/domain accounts from host",
          points: 4,
        },
        {
          roleId: "legal",
          roleIds: ["legal"],
          common: false,
          prompt:
            "Is CERT-In 6-hour reporting triggered yet? What do you start drafting?",
          expectedAction:
            "Start clock/prep note as suspected cyber on bank endpoint; confirm reportability with CISO as facts firm up",
          points: 4,
        },
        {
          roleId: "common",
          roleIds: [],
          common: true,
          prompt:
            "What single fact must all roles share in the next 10 minutes so nobody works from a different picture?",
          expectedAction:
            "Shared incident ticket: host ID, user, time, C2, containment state, next decision owner",
          points: 3,
        },
      ],
      aiGradeRubric: `${CISA_SCORE_PREAMBLE}
Inject focus: rapid isolate + evidence + early IR declaration without waiting for perfect attribution.`,
      consequences: [
        {
          id: "c1a",
          label: "Isolate host + open IR",
          scoreDelta: 3,
          worldState: "Host contained; IR cell live; phish mailbox quarantined",
          nextInjectId: "inj-02",
        },
        {
          id: "c1b",
          label: "Observe only",
          scoreDelta: -2,
          worldState: "Beacon continues; attacker gains dwell time",
          nextInjectId: "inj-02",
        },
      ],
      mediaPrompts: [],
    },
    {
      id: "inj-02",
      sequence: 2,
      title: "EDR disable / sensor tamper on finance VLAN",
      body: `ALERT · 08:41 IST
Crowdstrike console: sensor service stop + uninstall attempt on NL-FIN-WS-441 and two neighbouring finance machines.
Splunk: Windows Event 7045 / service deletion patterns consistent with defense-evasion tooling.
SOC notes: attacker appears to be clearing the path before moving deeper.`,
      timerSeconds: 300,
      targetRoleIds: ["ciso", "soc", "itops"],
      techniqueIds: ["T1562.001"],
      activeTeamIds: ["blue"],
      questions: [
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt:
            "How do you respond to EDR tamper — re-enable, isolate VLAN, or full finance segment quarantine?",
          expectedAction:
            "Treat as confirmed active adversary; isolate affected hosts/VLAN; block known tamper hashes; do not re-enable blindly on live attacker host",
          points: 5,
        },
        {
          roleId: "itops",
          roleIds: ["itops"],
          common: false,
          prompt:
            "What compensating controls do you put in place while EDR is degraded?",
          expectedAction:
            "Tighten firewall/host firewall, disable local admin where possible, increase SIEM monitoring, restrict outbound",
          points: 4,
        },
        {
          roleId: "ciso",
          roleIds: ["ciso"],
          common: false,
          prompt:
            "Do you authorize broader finance-floor network containment knowing RM desktops will go offline?",
          expectedAction:
            "Yes — prioritize integrity over branch desktop availability; brief business owner on impact",
          points: 5,
        },
        {
          roleId: "common",
          roleIds: [],
          common: true,
          prompt: "What is the one thing you must NOT do on the tampered hosts right now?",
          expectedAction:
            "Do not reimage/wipe before memory/disk evidence capture and EDR timeline export",
          points: 3,
        },
      ],
      aiGradeRubric: `${CISA_SCORE_PREAMBLE}
Inject focus: treat EDR disable as high-confidence adversary presence; contain broadly enough; preserve forensics.`,
      consequences: [
        {
          id: "c2a",
          label: "Segment isolate",
          scoreDelta: 3,
          worldState: "Finance VLAN restricted; tamper contained",
          nextInjectId: "inj-03",
        },
      ],
      mediaPrompts: [],
    },
    {
      id: "inj-03",
      sequence: 3,
      title: "Lateral movement — admin shares to file server",
      body: `DETECTION · 09:05 IST
SIEM: SMB admin$ / C$ access from NL-FIN-WS-441 → NL-FS-KYC-02 (customer KYC / shared drives).
New scheduled task and service install on the file server.
Threat intel: pattern matches known phishing-to-ransomware staging (CISA StopRansomware guidance).`,
      timerSeconds: 300,
      targetRoleIds: ["ciso", "soc", "itops", "biz"],
      techniqueIds: ["T1021.002", "T1078"],
      activeTeamIds: ["blue", "gold"],
      questions: [
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt:
            "What lateral-movement containment do you execute now, and how do you prove scope?",
          expectedAction:
            "Isolate file server + source host; hunt for other admin-share hops; pull auth logs for the stolen/abused account",
          points: 5,
        },
        {
          roleId: "itops",
          roleIds: ["itops"],
          common: false,
          prompt: "Which credentials do you rotate first, and how wide is the blast radius?",
          expectedAction:
            "Rotate the abused account + local admin equivalents; check service accounts with similar rights; invalidate sessions",
          points: 5,
        },
        {
          roleId: "biz",
          roleIds: ["biz"],
          common: false,
          prompt:
            "File shares for KYC ops may go offline — what business workaround do you authorize?",
          expectedAction:
            "Pause non-critical KYC processing; use manual/exception process; prioritize critical customer cases only",
          points: 4,
        },
        {
          roleId: "ciso",
          roleIds: ["ciso"],
          common: false,
          prompt:
            "Do you keep SWIFT / core banking in scope for heightened monitoring or pre-emptive isolation?",
          expectedAction:
            "Heighten monitoring on payment rails immediately; isolate only if indicators reach those segments",
          points: 4,
        },
      ],
      aiGradeRubric: `${CISA_SCORE_PREAMBLE}
Inject focus: stop lateral spread, rotate abused identities, protect payment rails, coordinate business impact.`,
      consequences: [
        {
          id: "c3a",
          label: "Contain FS + rotate creds",
          scoreDelta: 3,
          worldState: "Lateral path cut; KYC share offline for investigation",
          nextInjectId: "inj-04",
        },
      ],
      mediaPrompts: [],
    },
    {
      id: "inj-04",
      sequence: 4,
      title: "Privilege escalation — domain admin path suspected",
      body: `ESCALATION · 09:28 IST
Identity team: privileged group changes and unusual Kerberos activity from the file-server context.
Suspected path toward Domain Admin / tier-0.
IT Ops asks: wipe and rebuild now, or continue hunting?`,
      timerSeconds: 300,
      targetRoleIds: ["ciso", "soc", "itops", "legal"],
      techniqueIds: ["T1078"],
      activeTeamIds: ["blue", "gold"],
      questions: [
        {
          roleId: "itops",
          roleIds: ["itops"],
          common: false,
          prompt:
            "What is your privilege-escalation response plan for tier-0 / Domain Admin risk?",
          expectedAction:
            "Assume breach of privileged path; break glass password resets for DA/EA; restrict tier-0 access; engage identity forensics",
          points: 5,
        },
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt: "What signals confirm whether Domain Admin was achieved?",
          expectedAction:
            "Check DC auth logs, privileged group membership changes, golden/silver ticket indicators, new admin logons",
          points: 5,
        },
        {
          roleId: "ciso",
          roleIds: ["ciso"],
          common: false,
          prompt:
            "Do you authorize a controlled identity lockdown knowing many staff will be locked out?",
          expectedAction:
            "Authorize staged privileged lockdown; keep break-glass for critical ops; brief CEO on outage risk",
          points: 5,
        },
        {
          roleId: "legal",
          roleIds: ["legal"],
          common: false,
          prompt:
            "How does likely privileged compromise change your regulatory posture?",
          expectedAction:
            "Treat as material cyber incident; accelerate CERT-In/RBI readiness; document facts carefully without overstating confirmed data loss",
          points: 4,
        },
      ],
      aiGradeRubric: `${CISA_SCORE_PREAMBLE}
Inject focus: assume privileged path risk, lock down identity wisely, escalate regulatory readiness.`,
      consequences: [
        {
          id: "c4a",
          label: "Privileged lockdown",
          scoreDelta: 3,
          worldState: "Tier-0 hardened; DA path disrupted",
          nextInjectId: "inj-05",
        },
      ],
      mediaPrompts: [],
    },
    {
      id: "inj-05",
      sequence: 5,
      title: "Data exfiltration — KYC share egress",
      body: `EXFIL ALERT · 09:52 IST
NDR/proxy: ~180 GB compressed traffic from NL-FS-KYC-02 to a rare overseas ASN over the last 40 minutes.
Partial overlap with customer KYC folders.
Comms monitors Twitter/X: anonymous account claims “{{org}} customer docs dumping soon.”`,
      timerSeconds: 300,
      targetRoleIds: ["ciso", "soc", "legal", "comms", "biz"],
      techniqueIds: ["T1048"],
      activeTeamIds: ["blue", "gold"],
      questions: [
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt: "How do you stop further exfil without destroying evidence of what left?",
          expectedAction:
            "Block destination ASN/domains; isolate share; preserve proxy/NDR logs and file access audits for scoping",
          points: 5,
        },
        {
          roleId: "legal",
          roleIds: ["legal"],
          common: false,
          prompt:
            "Draft the first regulator-facing sentence for CERT-In / RBI given suspected KYC exfil.",
          expectedAction:
            "Suspected unauthorized access and possible exfiltration of customer KYC data from file share; investigation ongoing; no confirmed public dump yet",
          points: 5,
        },
        {
          roleId: "comms",
          roleIds: ["comms"],
          common: false,
          prompt:
            "Social posts claim a leak — what is your public posture in the next hour?",
          expectedAction:
            "No speculative denial; prepare holding statement; align with Legal/CISO; monitor only until facts cleared",
          points: 4,
        },
        {
          roleId: "biz",
          roleIds: ["biz"],
          common: false,
          prompt: "Which customer journeys do you pause or heighten scrutiny on?",
          expectedAction:
            "Heighten fraud monitoring; pause high-risk digital KYC changes; prepare call-center scripts",
          points: 4,
        },
        {
          roleId: "ciso",
          roleIds: ["ciso"],
          common: false,
          prompt: "Who do you brief now beyond the IR cell?",
          expectedAction:
            "CEO/board flash + regulator liaison + fraud ops; set decision clock for customer notification",
          points: 4,
        },
      ],
      aiGradeRubric: `${CISA_SCORE_PREAMBLE}
Inject focus: stop egress, preserve scope evidence, honest regulator language, disciplined public posture.`,
      consequences: [
        {
          id: "c5a",
          label: "Block egress + notify prep",
          scoreDelta: 3,
          worldState: "Exfil path blocked; regulator drafts ready; media watch live",
          nextInjectId: "inj-06",
        },
      ],
      mediaPrompts: [],
    },
    {
      id: "inj-06",
      sequence: 6,
      title: "Ransomware impact + public issues + regulatory response",
      body: `IMPACT · 10:20 IST
Ransom note on NL-FS-KYC-02 and two more file servers: encryption in progress; backup catalogs show recent shadow-copy deletion attempts.
Note demands BTC; threatens to publish KYC if unpaid by 18:00 IST.
Public issues: regional TV desk calling Comms; a customer-data leak hashtag trending regionally.
Regulators: RBI regional office and CERT-In expect a formal intimation. Board wants a go/no-go on customer SMS within 2 hours.

This is the directed end-state for the exercise: ransomware crisis with public and regulatory response.`,
      timerSeconds: 420,
      targetRoleIds: ["ciso", "soc", "itops", "legal", "comms", "biz"],
      techniqueIds: ["T1486"],
      activeTeamIds: ["blue", "gold"],
      questions: [
        {
          roleId: "ciso",
          roleIds: ["ciso"],
          common: false,
          prompt:
            "Pay, negotiate, or refuse — and what is your containment / recovery priority order?",
          expectedAction:
            "Refuse payment; prioritize isolate-encrypting systems, preserve evidence, restore from known-good backups after integrity checks",
          points: 6,
        },
        {
          roleId: "legal",
          roleIds: ["legal"],
          common: false,
          prompt: "Finalize CERT-In and RBI notification content and timing now.",
          expectedAction:
            "Submit within CERT-In window; inform RBI of ransomware + suspected KYC exposure; factual, no ransom-payment admission beyond refusal posture",
          points: 5,
        },
        {
          roleId: "comms",
          roleIds: ["comms"],
          common: false,
          prompt: "Write the three-line public holding statement.",
          expectedAction:
            "We are investigating a cyber incident; customer channels monitored; no instruction to click links claiming to be {{org}}; more updates after verification",
          points: 5,
        },
        {
          roleId: "biz",
          roleIds: ["biz"],
          common: false,
          prompt: "Which services stay up, which degrade, and how do you staff customer care?",
          expectedAction:
            "Keep core payments up if clean; degrade file-share dependent ops; surge call-center + fraud desk with scripted guidance",
          points: 4,
        },
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt: "What do you preserve before any restore/rebuild of encrypted servers?",
          expectedAction:
            "Forensic images, ransom note, EDR timelines, encryption process trees, backup integrity reports",
          points: 4,
        },
        {
          roleId: "itops",
          roleIds: ["itops"],
          common: false,
          prompt: "How do you validate backups before restoration?",
          expectedAction:
            "Offline integrity check; restore to isolated VLAN; malware scan; only then cut over",
          points: 4,
        },
      ],
      aiGradeRubric: `${CISA_SCORE_PREAMBLE}
Inject focus: no-pay stance, regulator-first honesty, disciplined public messaging, evidence before restore, business continuity with fraud watch.`,
      consequences: [
        {
          id: "c6a",
          label: "No pay · notify · recover clean",
          scoreDelta: 4,
          worldState:
            "Ransomware contained; regulators informed; public holding statement live; recovery from clean backups underway",
        },
      ],
      mediaPrompts: [],
    },
  ],
};

const PLAYERS: {
  email: string;
  name: string;
  roleId: string;
  team: "blue" | "gold";
}[] = [
  { email: "priya@demo.local", name: "Priya Shah", roleId: "ciso", team: "blue" },
  { email: "arjun@demo.local", name: "Arjun Mehta", roleId: "soc", team: "blue" },
  { email: "neha@demo.local", name: "Neha Iyer", roleId: "itops", team: "blue" },
  { email: "meera@demo.local", name: "Meera Kapoor", roleId: "legal", team: "gold" },
  { email: "kabir@demo.local", name: "Kabir Khan", roleId: "comms", team: "gold" },
  { email: "ravi@demo.local", name: "Ravi Desai", roleId: "biz", team: "gold" },
];

async function upsertUser(opts: {
  email: string;
  name: string;
  organizationId: string;
  password: string;
}) {
  const passwordHash = await hashPassword(opts.password);
  return prisma.user.upsert({
    where: { email: opts.email },
    create: {
      email: opts.email,
      name: opts.name,
      passwordHash,
      platformRole: "USER",
      organizationId: opts.organizationId,
      canFacilitate: false,
    },
    update: {
      name: opts.name,
      passwordHash,
      organizationId: opts.organizationId,
      platformRole: "USER",
    },
  });
}

async function absorbOrg(targetId: string, slug: string) {
  const legacy = await prisma.organization.findUnique({ where: { slug } });
  if (!legacy || legacy.id === targetId) return;
  await moveOrgRecords(targetId, legacy.id);
}

async function absorbLeftoverDemoOrgs(targetId: string) {
  const leftovers = await prisma.organization.findMany({
    where: {
      id: { not: targetId },
      OR: [
        { slug: { startsWith: "retired-demo-" } },
        { name: { contains: "legacy slug" } },
      ],
    },
  });
  for (const leftover of leftovers) {
    await moveOrgRecords(targetId, leftover.id);
  }
}

async function moveOrgRecords(targetId: string, fromId: string) {
  if (fromId === targetId) return;
  await prisma.user.updateMany({
    where: { organizationId: fromId },
    data: { organizationId: targetId },
  });
  await prisma.exercise.updateMany({
    where: { organizationId: fromId },
    data: { organizationId: targetId },
  });
  await prisma.exerciseSession.updateMany({
    where: { organizationId: fromId },
    data: { organizationId: targetId },
  });

  const assignments = await prisma.orgAssignment.findMany({
    where: { organizationId: fromId },
  });
  for (const row of assignments) {
    const clash = await prisma.orgAssignment.findUnique({
      where: {
        userId_organizationId: {
          userId: row.userId,
          organizationId: targetId,
        },
      },
    });
    if (clash) {
      await prisma.orgAssignment.delete({ where: { id: row.id } });
    } else {
      await prisma.orgAssignment.update({
        where: { id: row.id },
        data: { organizationId: targetId },
      });
    }
  }

  const clients = await prisma.exerciseClient.findMany({
    where: { organizationId: fromId },
  });
  for (const row of clients) {
    const clash = await prisma.exerciseClient.findUnique({
      where: {
        exerciseId_organizationId: {
          exerciseId: row.exerciseId,
          organizationId: targetId,
        },
      },
    });
    if (clash) {
      await prisma.exerciseClient.delete({
        where: {
          exerciseId_organizationId: {
            exerciseId: row.exerciseId,
            organizationId: fromId,
          },
        },
      });
    } else {
      await prisma.exerciseClient.update({
        where: {
          exerciseId_organizationId: {
            exerciseId: row.exerciseId,
            organizationId: fromId,
          },
        },
        data: { organizationId: targetId },
      });
    }
  }

  await prisma.organization.delete({ where: { id: fromId } }).catch(async () => {
    await prisma.organization.update({
      where: { id: fromId },
      data: {
        name: "Retired demo org",
        slug: `retired-demo-${fromId.slice(-6)}`,
      },
    });
  });
}

async function resolveDemoOrg() {
  const existing = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
  });

  const org = existing
    ? await prisma.organization.update({
        where: { id: existing.id },
        data: {
          name: ORG_NAME,
          slug: ORG_SLUG,
          sector: "bfsi_in",
          notes: "Fictional demo bank for phishing→ransomware TTX",
        },
      })
    : await prisma.organization.create({
        data: {
          name: ORG_NAME,
          slug: ORG_SLUG,
          sector: "bfsi_in",
          notes: "Fictional demo bank for phishing→ransomware TTX",
        },
      });

  for (const slug of LEGACY_SLUGS) {
    await absorbOrg(org.id, slug);
  }
  await absorbLeftoverDemoOrgs(org.id);
  return org;
}

async function migrateEmail(from: string, to: string, organizationId: string) {
  const old = await prisma.user.findUnique({ where: { email: from } });
  if (!old) return;
  const clash = await prisma.user.findUnique({ where: { email: to } });
  if (!clash) {
    await prisma.user.update({
      where: { id: old.id },
      data: {
        email: to,
        organizationId,
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    });
    return;
  }
  await prisma.user.update({
    where: { id: old.id },
    data: { organizationId },
  });
}

async function main() {
  const parsed = parseExerciseDocument(doc);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error("Scenario document failed schema validation");
  }

  const org = await resolveDemoOrg();

  const admin = await prisma.user.findFirst({ where: { email: "operator@local" } });
  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { canFacilitate: true },
    });
  }

  for (const player of PLAYERS) {
    const local = player.email.split("@")[0];
    for (const domain of LEGACY_EMAIL_DOMAINS) {
      await migrateEmail(`${local}@${domain}`, player.email, org.id);
    }
  }

  const users = [];
  for (const p of PLAYERS) {
    users.push({
      ...p,
      user: await upsertUser({
        email: p.email,
        name: p.name,
        organizationId: org.id,
        password: DEMO_PASSWORD,
      }),
    });
  }

  let exercise = await prisma.exercise.findFirst({
    where: {
      organizationId: org.id,
      OR: [{ title: doc.title }, { title: { contains: "PhishGate" } }],
    },
  });

  const withMedia = await attachStageMedia(
    exercise?.id ?? "pending",
    parsed.data,
  );

  if (exercise) {
    const mediaReady = await attachStageMedia(exercise.id, parsed.data);
    exercise = await prisma.exercise.update({
      where: { id: exercise.id },
      data: {
        title: doc.title,
        durationMin: doc.durationMin,
        sector: doc.sector,
        document: mediaReady,
        organizationId: org.id,
        authorId: admin?.id,
      },
    });
  } else {
    exercise = await prisma.exercise.create({
      data: {
        title: doc.title,
        durationMin: doc.durationMin,
        sector: doc.sector,
        document: withMedia,
        organizationId: org.id,
        authorId: admin?.id,
      },
    });
    // Rewrite media paths under real exercise id
    const mediaReady = await attachStageMedia(exercise.id, parsed.data);
    exercise = await prisma.exercise.update({
      where: { id: exercise.id },
      data: { document: mediaReady },
    });
  }

  // Close other live runs so the demo session is the clear active one
  await prisma.exerciseSession.updateMany({
    where: { status: "live", joinCode: { not: JOIN_CODE } },
    data: {
      status: "closed",
      phase: "debrief",
      closedAt: new Date(),
    },
  });

  // Reuse or create demo session with fixed join code
  let session = await prisma.exerciseSession.findUnique({
    where: { joinCode: JOIN_CODE },
  });
  if (!session) {
    for (const code of LEGACY_JOIN_CODES) {
      const legacy = await prisma.exerciseSession.findUnique({
        where: { joinCode: code },
      });
      if (legacy) {
        session = await prisma.exerciseSession.update({
          where: { id: legacy.id },
          data: { joinCode: JOIN_CODE },
        });
        break;
      }
    }
  }
  if (session) {
    // Clear prior seats/teams/answers for a clean demo
    await prisma.injectAnswer.deleteMany({ where: { sessionId: session.id } });
    await prisma.sessionSeat.deleteMany({ where: { sessionId: session.id } });
    await prisma.sessionTeamMember.deleteMany({
      where: { team: { sessionId: session.id } },
    });
    await prisma.sessionTeam.deleteMany({ where: { sessionId: session.id } });
    session = await prisma.exerciseSession.update({
      where: { id: session.id },
      data: {
        exerciseId: exercise.id,
        organizationId: org.id,
        status: "draft",
        phase: "idle",
        runKind: "engagement",
        currentInjectId: null,
        currentInjectStartedAt: null,
        startedAt: null,
        closedAt: null,
        injectTeamPlan: Prisma.DbNull,
      },
    });
  } else {
    session = await prisma.exerciseSession.create({
      data: {
        joinCode: JOIN_CODE,
        status: "draft",
        phase: "idle",
        runKind: "engagement",
        organizationId: org.id,
        exerciseId: exercise.id,
      },
    });
  }

  const blue = await prisma.sessionTeam.create({
    data: { sessionId: session.id, name: "Blue Cell · Cyber Response" },
  });
  const gold = await prisma.sessionTeam.create({
    data: { sessionId: session.id, name: "Gold Cell · Crisis & Regulators" },
  });
  const teamId = { blue: blue.id, gold: gold.id };

  if (admin) {
    await prisma.sessionSeat.create({
      data: {
        sessionId: session.id,
        userId: admin.id,
        kind: "MODERATOR",
      },
    });
  }

  for (const row of users) {
    await prisma.sessionTeamMember.create({
      data: { teamId: teamId[row.team], userId: row.user.id },
    });
    await prisma.sessionSeat.create({
      data: {
        sessionId: session.id,
        userId: row.user.id,
        kind: "PARTICIPANT",
        playbookRoleId: row.roleId,
        teamId: teamId[row.team],
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        org: { id: org.id, name: org.name, slug: org.slug },
        exercise: { id: exercise.id, title: exercise.title },
        session: {
          id: session.id,
          joinCode: session.joinCode,
          url: `/sessions/${session.id}`,
        },
        password: DEMO_PASSWORD,
        players: users.map((u) => ({
          email: u.email,
          name: u.name,
          role: u.roleId,
          team: u.team,
        })),
        facilitator: "operator@local (MODERATOR)",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
