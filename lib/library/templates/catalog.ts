import type { ExerciseDocument } from "@/lib/schema/exercise";

export type LibraryKind = "scenario_pack" | "inject_pack";

export type LibraryTemplateDef = {
  key: string;
  kind: LibraryKind;
  tags: string[];
  coverImagePath: string;
  document: Omit<ExerciseDocument, "teamDefinitions"> & {
    teamDefinitions?: ExerciseDocument["teamDefinitions"];
  };
};

function baseRoles() {
  return [
    {
      id: "ciso",
      name: "CISO",
      description: "Owns cyber decision rights",
      expectedDecisions: ["Invoke IR plan", "Brief executives"],
    },
    {
      id: "soc",
      name: "SOC Lead",
      description: "Detection and containment",
      expectedDecisions: ["Isolate segment", "Preserve evidence"],
    },
    {
      id: "legal",
      name: "Legal / Compliance",
      description: "Regulator and customer notice",
      expectedDecisions: ["RBI / CERT-In timeline"],
    },
    {
      id: "comms",
      name: "Communications",
      description: "Internal and customer messaging",
      expectedDecisions: ["Holding statement"],
    },
  ];
}

export const LIBRARY_TEMPLATES: LibraryTemplateDef[] = [
  {
    key: "ransomware-swift",
    kind: "scenario_pack",
    tags: ["ransomware", "bfsi", "payments"],
    coverImagePath: "/library/ransomware-swift/cover.svg",
    document: {
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
      roles: baseRoles(),
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
          activeTeamIds: [],
          questions: [
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt:
                "Do you authorize taking SWIFT offline, knowing settlements halt?",
              expectedAction: "Yes, with CEO notify in 15m",
              points: 5,
            },
            {
              roleId: "soc",
              roleIds: ["soc"],
              common: false,
              prompt: "Which segment do you isolate first, and what log do you pull?",
              expectedAction: "SWIFT VLAN + EDR timeline",
              points: 5,
            },
            {
              roleId: "legal",
              roleIds: ["legal"],
              common: false,
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
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: SWIFT jump-host encryption alert on a cool-gray briefing slide. Rust #C45C3E only on the High status chip and one containment callout. Flat illustration, no logos.",
              aspect: "16:9",
              assetPath: "/library/ransomware-swift/inject-01.svg",
            },
            {
              kind: "video",
              prompt:
                "12s still-to-still of the same SWIFT inject board: status chip steps from Elevated amber to High rust; no camera pan, no faces",
              aspect: "16:9",
              durationSec: 15,
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
          activeTeamIds: [],
          questions: [
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt: "Do you brief the board now or after forensics?",
              expectedAction: "Board flash + no-pay stance",
              points: 5,
            },
            {
              roleId: "legal",
              roleIds: ["legal"],
              common: false,
              prompt: "Draft the first sentence of the RBI intimation.",
              expectedAction:
                "Suspected cyber on payment infra, no confirmed data loss",
              points: 5,
            },
            {
              roleId: "soc",
              roleIds: ["soc"],
              common: false,
              prompt:
                "What evidence do you preserve before the vendor images the disk?",
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
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: ransom-note excerpt citing a regulator circular. Crimson #B42318 only on the Critical chip and demand line. Cool-gray field, no logos.",
              aspect: "1:1",
              assetPath: "/library/ransomware-swift/inject-02.svg",
            },
          ],
        },
      ],
    },
  },
  {
    key: "bec-ceo-fraud",
    kind: "scenario_pack",
    tags: ["bec", "fraud", "bfsi"],
    coverImagePath: "/library/bec-ceo-fraud/cover.svg",
    document: {
      title: "BEC: urgent CEO wire request",
      durationMin: 75,
      objectives: [
        "Validate payment authority under dual control",
        "Contain mailbox compromise without tipping actor",
      ],
      sector: "bfsi_in",
      regulatorTags: ["RBI", "CERT-In"],
      clientProfile: {
        orgType: "NBFC treasury desk",
        criticalAssets: ["Corporate email", "Treasury portal"],
        stackNotes: "M365, Proofpoint, SAP payments",
      },
      intelCitations: { cveIds: [], groupIds: [], advisories: [] },
      attackMap: {
        techniques: [
          { id: "T1566", name: "Phishing", tactic: "Initial Access" },
          { id: "T1078", name: "Valid Accounts", tactic: "Initial Access" },
        ],
      },
      detectionPlaybooks: [
        {
          techniqueId: "T1566",
          name: "Impersonation mail",
          logSource: "Email gateway",
          alertName: "Lookalike display name",
          expectedDetection: "BEC rule on CFO/CEO display-name mismatch",
        },
      ],
      roles: baseRoles(),
      modules: [
        {
          id: "m1",
          name: "Fraud window",
          narrative: "Friday 17:40 IST — ‘CEO’ asks for a confidential vendor wire.",
          discussionQuestions: ["What is the callback policy?"],
        },
      ],
      injects: [
        {
          id: "inj-01",
          sequence: 1,
          title: "Urgent wire from ‘CEO’",
          body: "Finance receives an email from a lookalike domain requesting ₹4.8 Cr wire to a new UAE beneficiary ‘before board close’.",
          timerSeconds: 240,
          targetRoleIds: ["ciso", "legal", "comms"],
          techniqueIds: ["T1566"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt: "Do you freeze the payment queue or only this request?",
              expectedAction: "Freeze new beneficiary wires pending callback",
              points: 5,
            },
            {
              roleId: "legal",
              roleIds: ["legal"],
              common: false,
              prompt: "What dual-control evidence do you need before any release?",
              expectedAction: "Recorded callback + maker-checker log",
              points: 4,
            },
            {
              roleId: "comms",
              roleIds: ["comms"],
              common: false,
              prompt: "Internal note to staff — what do you say without causing panic?",
              expectedAction: "Verify unusual payment asks via known channels",
              points: 3,
            },
          ],
          aiGradeRubric: "Callback + dual control + quiet containment.",
          consequences: [
            {
              id: "c1",
              label: "Hold wire",
              scoreDelta: 3,
              worldState: "Payment blocked",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: CEO wire-request email excerpt on a cool-gray slide. Amber #C4A35A on the Elevated chip and one flagged field. Flat illustration, no brand marks.",
              aspect: "16:9",
              assetPath: "/library/bec-ceo-fraud/inject-01.svg",
            },
            {
              kind: "video",
              prompt:
                "12s motion graphic of an email morphing into a fraudulent payment instruction; no real brand marks",
              aspect: "16:9",
              durationSec: 12,
            },
          ],
        },
        {
          id: "inj-02",
          sequence: 2,
          title: "Mailbox rules found",
          body: "IR finds inbox rules forwarding CEO mail to an external Proton address for 11 days.",
          timerSeconds: 300,
          targetRoleIds: ["soc", "ciso"],
          techniqueIds: ["T1078"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "soc",
              roleIds: ["soc"],
              common: false,
              prompt: "What do you revoke first without alerting the actor?",
              expectedAction: "Sessions + app passwords, keep mailbox online briefly",
              points: 5,
            },
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt: "Do you disclose to the board this weekend?",
              expectedAction: "Same-day flash to CRO/CEO, full brief Monday",
              points: 4,
            },
          ],
          aiGradeRubric: "Quiet lockout, evidence, executive flash.",
          consequences: [
            {
              id: "c2",
              label: "Revoke sessions",
              scoreDelta: 2,
              worldState: "Forwarding killed",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: inbox forwarding rule on a muted admin list. Amber #C4A35A on the Elevated chip and the flagged rule row. No dark console chrome.",
              aspect: "16:9",
              assetPath: "/library/bec-ceo-fraud/inject-02.svg",
            },
          ],
        },
      ],
    },
  },
  {
    key: "supply-chain-vendor",
    kind: "scenario_pack",
    tags: ["supply-chain", "vendor", "gov"],
    coverImagePath: "/library/supply-chain-vendor/cover.svg",
    document: {
      title: "Compromised MSP push to endpoints",
      durationMin: 100,
      objectives: [
        "Contain vendor remote access",
        "Coordinate sector CERT notification",
      ],
      sector: "gov",
      regulatorTags: ["CERT-In", "CISA"],
      clientProfile: {
        orgType: "State department IT",
        criticalAssets: ["Citizen portal", "Endpoint fleet"],
        stackNotes: "Intune, CrowdStrike, vendor RMM",
      },
      intelCitations: { cveIds: [], groupIds: [], advisories: [] },
      attackMap: {
        techniques: [
          {
            id: "T1190",
            name: "Exploit Public-Facing Application",
            tactic: "Initial Access",
          },
          { id: "T1078", name: "Valid Accounts", tactic: "Initial Access" },
        ],
      },
      detectionPlaybooks: [
        {
          techniqueId: "T1078",
          name: "Odd RMM package",
          logSource: "EDR",
          alertName: "Unsigned RMM script",
          expectedDetection: "New scheduled task from MSP account",
        },
      ],
      roles: baseRoles(),
      modules: [
        {
          id: "m1",
          name: "Vendor blast radius",
          narrative: "MSP pushes a ‘critical patch’ package to 400 laptops.",
          discussionQuestions: ["Who can revoke MSP credentials?"],
        },
      ],
      injects: [
        {
          id: "inj-01",
          sequence: 1,
          title: "Unsigned package via RMM",
          body: "EDR flags an unsigned PowerShell drop from the MSP service account across three sites.",
          timerSeconds: 300,
          targetRoleIds: ["soc", "ciso"],
          techniqueIds: ["T1078"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "soc",
              roleIds: ["soc"],
              common: false,
              prompt: "Do you disable the MSP connector globally or per site?",
              expectedAction: "Global disable + allowlist emergency break-glass",
              points: 5,
            },
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt: "When do you notify the MSP vs CERT-In?",
              expectedAction: "Contain first, then joint call within 1h",
              points: 4,
            },
          ],
          aiGradeRubric: "Contain vendor path, then coordinated notify.",
          consequences: [
            {
              id: "c1",
              label: "Cut RMM",
              scoreDelta: 3,
              worldState: "MSP offline",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: vendor RMM blast on a muted network map. Amber #C4A35A on the Elevated chip and the highlighted vendor node. Cool-gray field, no lime wash.",
              aspect: "16:9",
              assetPath: "/library/supply-chain-vendor/inject-01.svg",
            },
            {
              kind: "video",
              prompt:
                "18s abstract animation of a software update packet spreading across a network graph then being quarantined",
              aspect: "16:9",
              durationSec: 18,
            },
          ],
        },
      ],
    },
  },
  {
    key: "credential-stuffing-ib",
    kind: "scenario_pack",
    tags: ["credential-stuffing", "ib", "bfsi"],
    coverImagePath: "/library/credential-stuffing-ib/cover.svg",
    document: {
      title: "Internet banking credential stuffing",
      durationMin: 80,
      objectives: [
        "Protect customers without wholesale outage",
        "Align fraud + cyber + regulator messaging",
      ],
      sector: "bfsi_in",
      regulatorTags: ["RBI", "CERT-In"],
      clientProfile: {
        orgType: "Retail bank digital channel",
        criticalAssets: ["Internet banking", "Mobile app"],
        stackNotes: "WAF, bot management, MFA",
      },
      intelCitations: { cveIds: [], groupIds: [], advisories: [] },
      attackMap: {
        techniques: [
          { id: "T1078", name: "Valid Accounts", tactic: "Initial Access" },
        ],
      },
      detectionPlaybooks: [
        {
          techniqueId: "T1078",
          name: "Credential stuffing",
          logSource: "WAF / IdP",
          alertName: "Impossible travel + spray",
          expectedDetection: "Bot score spike on /login",
        },
      ],
      roles: baseRoles(),
      modules: [
        {
          id: "m1",
          name: "Channel under fire",
          narrative: "Login failures 40× baseline; fraud desk sees mule withdrawals.",
          discussionQuestions: ["Step-up MFA vs channel downtime?"],
        },
      ],
      injects: [
        {
          id: "inj-01",
          sequence: 1,
          title: "Bot spray on /login",
          body: "WAF shows residential-proxy spray against internet banking; 2.1% success on non-MFA legacy users.",
          timerSeconds: 270,
          targetRoleIds: ["soc", "ciso", "comms"],
          techniqueIds: ["T1078"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "soc",
              roleIds: ["soc"],
              common: false,
              prompt: "Which control do you raise first: bot score, geo, or MFA force?",
              expectedAction: "Bot challenge + force MFA on legacy cohort",
              points: 5,
            },
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt: "Do you take IB offline?",
              expectedAction: "No full outage; degrade to MFA-only",
              points: 5,
            },
            {
              roleId: "comms",
              roleIds: ["comms"],
              common: false,
              prompt: "Customer SMS wording?",
              expectedAction: "Warn of phishing/credential risk, never ask for OTP",
              points: 3,
            },
          ],
          aiGradeRubric: "Protect customers without unnecessary outage.",
          consequences: [
            {
              id: "c1",
              label: "Force MFA",
              scoreDelta: 3,
              worldState: "Legacy logins blocked",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: login-traffic chart on cool gray. Rust #C45C3E on the High chip and the spike callout. No lime wash.",
              aspect: "16:9",
              assetPath: "/library/credential-stuffing-ib/inject-01.svg",
            },
            {
              kind: "video",
              prompt:
                "10s of the same login-traffic board: High rust chip holds while the blocked-attempt count ticks; no HUD chrome",
              aspect: "16:9",
              durationSec: 10,
            },
          ],
        },
      ],
    },
  },
  {
    key: "inject-regulator-notify",
    kind: "inject_pack",
    tags: ["regulator", "bfsi", "legal"],
    coverImagePath: "/library/inject-regulator-notify/cover.svg",
    document: {
      title: "Inject pack: Regulator notify",
      durationMin: 60,
      objectives: ["Practice first regulator intimation under time pressure"],
      sector: "bfsi_in",
      regulatorTags: ["RBI", "CERT-In"],
      clientProfile: {
        orgType: "Bank",
        criticalAssets: ["Payments"],
        stackNotes: "Generic",
      },
      intelCitations: { cveIds: [], groupIds: [], advisories: [] },
      attackMap: {
        techniques: [
          { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact" },
        ],
      },
      detectionPlaybooks: [],
      roles: baseRoles(),
      modules: [
        {
          id: "m1",
          name: "Notify",
          narrative: "Single-inject pack for workshop swaps.",
          discussionQuestions: ["Who signs the first regulator note?"],
        },
      ],
      injects: [
        {
          id: "inj-reg-01",
          sequence: 1,
          title: "CERT-In / RBI first notice",
          body: "Legal asks for the first sentence of the regulator intimation within 20 minutes of confirmed cyber impact on payment infra.",
          timerSeconds: 240,
          targetRoleIds: ["legal", "ciso", "comms"],
          techniqueIds: ["T1486"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "legal",
              roleIds: ["legal"],
              common: false,
              prompt: "Draft the first sentence of the RBI intimation.",
              expectedAction:
                "Suspected cyber on payment infra; impact assessment underway; no confirmed customer data loss",
              points: 5,
            },
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt: "What facts do you certify before Legal sends?",
              expectedAction: "Systems impacted, containment status, no ransom decision yet",
              points: 4,
            },
            {
              roleId: "comms",
              roleIds: ["comms"],
              common: false,
              prompt: "Do you publish externally now?",
              expectedAction: "No external post; internal need-to-know only",
              points: 3,
            },
          ],
          aiGradeRubric: "Accurate, non-alarmist, regulator-first.",
          consequences: [
            {
              id: "c1",
              label: "Send notice",
              scoreDelta: 3,
              worldState: "Regulator clock started",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: regulator notice draft on cool-gray paper. Crimson #B42318 only on the Critical 6-hour clock chip. No dark ops desk.",
              aspect: "16:9",
              assetPath: "/library/inject-regulator-notify/inject-01.svg",
            },
            {
              kind: "video",
              prompt: "12s countdown over a blank notice template filling with key facts",
              aspect: "16:9",
              durationSec: 12,
            },
          ],
        },
      ],
    },
  },
  {
    key: "inject-containment-call",
    kind: "inject_pack",
    tags: ["containment", "soc", "bfsi"],
    coverImagePath: "/library/inject-containment-call/cover.svg",
    document: {
      title: "Inject pack: Containment call",
      durationMin: 60,
      objectives: ["Force a clear isolate-vs-continue decision"],
      sector: "bfsi_in",
      regulatorTags: ["CERT-In"],
      clientProfile: {
        orgType: "Bank",
        criticalAssets: ["Core segment"],
        stackNotes: "EDR + SIEM",
      },
      intelCitations: { cveIds: [], groupIds: [], advisories: [] },
      attackMap: {
        techniques: [
          { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact" },
        ],
      },
      detectionPlaybooks: [],
      roles: baseRoles(),
      modules: [
        {
          id: "m1",
          name: "Contain",
          narrative: "Workshop swap inject for isolation decisions.",
          discussionQuestions: ["Who can authorize segment kill?"],
        },
      ],
      injects: [
        {
          id: "inj-con-01",
          sequence: 1,
          title: "Isolate the hot segment?",
          body: "EDR confirms lateral movement into the payments VLAN. Isolating stops settlements for ~90 minutes.",
          timerSeconds: 300,
          targetRoleIds: ["ciso", "soc"],
          techniqueIds: ["T1486"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "ciso",
              roleIds: ["ciso"],
              common: false,
              prompt: "Do you authorize full VLAN isolation now?",
              expectedAction: "Yes, with CEO flash and settlement pause messaging",
              points: 5,
            },
            {
              roleId: "soc",
              roleIds: ["soc"],
              common: false,
              prompt: "What do you pull before the cut?",
              expectedAction: "EDR timeline + firewall hit counts + memory on two hosts",
              points: 5,
            },
          ],
          aiGradeRubric: "Decisive containment with evidence capture.",
          consequences: [
            {
              id: "c1",
              label: "Isolate",
              scoreDelta: 3,
              worldState: "VLAN down",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: network map with one VLAN marked quarantine. Rust #C45C3E on the High chip and that segment only. Neutral slate field.",
              aspect: "16:9",
              assetPath: "/library/inject-containment-call/inject-01.svg",
            },
          ],
        },
      ],
    },
  },
  {
    key: "inject-comms-holding",
    kind: "inject_pack",
    tags: ["comms", "bfsi"],
    coverImagePath: "/library/inject-comms-holding/cover.svg",
    document: {
      title: "Inject pack: Holding statement",
      durationMin: 60,
      objectives: ["Produce a calm internal holding line"],
      sector: "bfsi_in",
      regulatorTags: ["RBI"],
      clientProfile: {
        orgType: "Bank",
        criticalAssets: ["Brand"],
        stackNotes: "Comms desk",
      },
      intelCitations: { cveIds: [], groupIds: [], advisories: [] },
      attackMap: {
        techniques: [
          { id: "T1566", name: "Phishing", tactic: "Initial Access" },
        ],
      },
      detectionPlaybooks: [],
      roles: baseRoles(),
      modules: [
        {
          id: "m1",
          name: "Comms",
          narrative: "Workshop swap for customer/staff messaging.",
          discussionQuestions: ["Who approves the SMS?"],
        },
      ],
      injects: [
        {
          id: "inj-com-01",
          sequence: 1,
          title: "Staff & customer holding line",
          body: "Rumors are spreading on WhatsApp that the bank was hacked. Comms needs a holding line in 10 minutes.",
          timerSeconds: 180,
          targetRoleIds: ["comms", "legal", "ciso"],
          techniqueIds: ["T1566"],
          activeTeamIds: [],
          questions: [
            {
              roleId: "comms",
              roleIds: ["comms"],
              common: false,
              prompt: "Write the internal all-hands first line.",
              expectedAction:
                "We are investigating a service disruption; use official channels only; do not speculate",
              points: 5,
            },
            {
              roleId: "legal",
              roleIds: ["legal"],
              common: false,
              prompt: "What must Comms not say yet?",
              expectedAction: "No admission of breach or data loss until confirmed",
              points: 4,
            },
          ],
          aiGradeRubric: "Calm, accurate, no over-disclosure.",
          consequences: [
            {
              id: "c1",
              label: "Send holding",
              scoreDelta: 2,
              worldState: "Narrative controlled",
            },
          ],
          mediaPrompts: [
            {
              kind: "image",
              prompt:
                "16:9 tabletop inject board: holding-statement card on off-white. Teal #2F6F7E on the Watch chip and headline rule. No dark brand wash.",
              aspect: "1:1",
              assetPath: "/library/inject-comms-holding/inject-01.svg",
            },
          ],
        },
      ],
    },
  },
];
