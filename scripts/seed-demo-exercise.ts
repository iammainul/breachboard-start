import { prisma } from "../lib/prisma";

const doc = {
  title: "Ransomware on SWIFT gateway",
  durationMin: 90,
  objectives: [
    "Decide containment vs business continuity",
    "Coordinate regulator notification",
  ],
  sector: "bfsi_in",
  regulatorTags: ["RBI", "CERT-In"],
  clientProfile: {
    orgType: "Private sector bank",
    criticalAssets: ["SWIFT", "Core banking"],
    stackNotes: "On-prem AD, Splunk",
  },
  intelCitations: { cveIds: [], groupIds: ["G0016"], advisories: [] },
  attackMap: {
    groupId: "G0016",
    groupName: "APT29",
    techniques: [
      { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact" },
    ],
  },
  detectionPlaybooks: [
    {
      techniqueId: "T1486",
      name: "Ransom note on file server",
      logSource: "EDR",
      alertName: "Mass encryption",
      expectedDetection: "EDR mass-rename burst",
    },
  ],
  roles: [
    {
      id: "ciso",
      name: "CISO",
      description: "Owns cyber decision rights",
      expectedDecisions: ["Invoke IR plan"],
    },
    {
      id: "soc",
      name: "SOC Lead",
      description: "Detection and containment",
      expectedDecisions: ["Isolate segment"],
    },
    {
      id: "legal",
      name: "Legal / Compliance",
      description: "Regulator and customer notice",
      expectedDecisions: ["RBI timeline"],
    },
  ],
  modules: [
    {
      id: "m1",
      name: "Response",
      narrative: "Overnight encryption on the SWIFT jump host.",
      discussionQuestions: ["Who owns the call to suspend SWIFT?"],
    },
  ],
  injects: [
    {
      id: "inj-01",
      sequence: 1,
      title: "SOC: mass encryption on jump host",
      body: "Splunk fires: 12k files encrypted on SWIFT-JH-01 in 4 minutes. EDR isolate failed.",
      timerSeconds: 300,
      targetRoleIds: ["ciso", "soc"],
      techniqueIds: ["T1486"],
      questions: [
        {
          roleId: "ciso",
          prompt: "Do you authorize taking SWIFT offline, knowing settlements halt?",
          expectedAction: "Yes, with CEO notify in 15m",
          points: 5,
        },
        {
          roleId: "soc",
          prompt: "Which segment do you isolate first, and what log do you pull?",
          expectedAction: "SWIFT VLAN + EDR timeline",
          points: 5,
        },
        {
          roleId: "legal",
          prompt: "Is this a CERT-In 6-hour reportable incident yet?",
          expectedAction: "Not until confirmed cyber, start clock",
          points: 3,
        },
      ],
      aiGradeRubric: "Reward decisive isolation plus regulator awareness.",
      consequences: [
        {
          id: "c1",
          label: "Take SWIFT down",
          scoreDelta: 2,
          worldState: "Settlements paused",
        },
      ],
    },
    {
      id: "inj-02",
      sequence: 2,
      title: "Ransom note names RBI circular",
      body: "Note claims they will leak customer KYC unless 400 BTC is paid by 09:00 IST.",
      timerSeconds: 300,
      targetRoleIds: ["ciso", "legal"],
      techniqueIds: ["T1486"],
      questions: [
        {
          roleId: "ciso",
          prompt: "Do you brief the board now or after forensics?",
          expectedAction: "Board flash + no-pay stance",
          points: 5,
        },
        {
          roleId: "legal",
          prompt: "Draft the first sentence of the RBI intimation.",
          expectedAction: "Suspected cyber on payment infra, no confirmed data loss",
          points: 5,
        },
        {
          roleId: "soc",
          prompt: "What evidence do you preserve before the vendor images the disk?",
          expectedAction: "Memory + EDR quarantine hold",
          points: 4,
        },
      ],
      aiGradeRubric: "No-pay, regulator-first, evidence preservation.",
      consequences: [
        {
          id: "c2",
          label: "Notify RBI",
          scoreDelta: 3,
          worldState: "Regulator clock started",
        },
      ],
    },
  ],
};

async function main() {
  const existing = await prisma.exercise.findFirst({
    where: { title: doc.title },
  });
  if (existing) {
    console.log(existing.id);
    return;
  }
  const org = await prisma.organization.findFirst({
    where: { slug: "northline-bank" },
  });
  const admin = await prisma.user.findFirst({
    where: { email: "operator@local" },
  });
  const ex = await prisma.exercise.create({
    data: {
      title: doc.title,
      durationMin: 90,
      sector: "bfsi_in",
      status: "accepted",
      lineageKey: "northline-swift-ransomware",
      document: doc,
      organizationId: org?.id,
      authorId: admin?.id,
    },
  });
  console.log(ex.id);
}

main();
