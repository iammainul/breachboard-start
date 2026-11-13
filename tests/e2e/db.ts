import { PrismaClient, type Prisma } from "@prisma/client";
import { parseExerciseDocument } from "../../lib/schema/exercise";

let client: PrismaClient | undefined;

export function e2ePrisma() {
  client ??= new PrismaClient();
  return client;
}

/** Backdate the discuss clock so the next seated poll flips to answering. */
export async function expireDiscussWindow(sessionId: string) {
  await e2ePrisma().exerciseSession.update({
    where: { id: sessionId },
    data: { currentInjectStartedAt: new Date(Date.now() - 130_000) },
  });
}

const NO_RUBRIC_DOCUMENT = {
  title: "E2E honest scoring",
  durationMin: 60,
  objectives: ["Prove empty-rubric answers stay at zero until marked"],
  sector: "bfsi_in" as const,
  regulatorTags: ["CISA" as const],
  clientProfile: {
    orgType: "E2E bank",
    criticalAssets: ["core"],
    stackNotes: "fixture",
  },
  intelCitations: { cveIds: [], groupIds: [], advisories: [] },
  attackMap: { groupId: "G0000", groupName: "None", techniques: [] },
  detectionPlaybooks: [],
  roles: [
    {
      id: "soc",
      name: "SOC Lead",
      description: "E2E role",
      expectedDecisions: ["Contain"],
    },
  ],
  teamDefinitions: [],
  modules: [
    {
      id: "m-e2e",
      name: "Fixture",
      narrative: "No-rubric inject",
      discussionQuestions: ["What do you do?"],
    },
  ],
  injects: [
    {
      id: "inj-e2e-1",
      sequence: 1,
      title: "No rubric inject",
      body: "A host beaconed. There is no scoring key for this inject.",
      timerSeconds: 120,
      targetRoleIds: ["soc"],
      techniqueIds: [],
      activeTeamIds: [],
      questions: [
        {
          roleId: "soc",
          roleIds: ["soc"],
          common: false,
          prompt: "What do you do right now?",
          expectedAction: "",
          points: 5,
        },
      ],
      aiGradeRubric: "",
      consequences: [],
      mediaPrompts: [],
    },
  ],
};

export async function createNoRubricExercise(organizationId: string) {
  const parsed = parseExerciseDocument(NO_RUBRIC_DOCUMENT);
  if (!parsed.success) {
    throw new Error(
      `E2E no-rubric document failed schema: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }
  return e2ePrisma().exercise.create({
    data: {
      title: parsed.data.title,
      durationMin: parsed.data.durationMin,
      sector: parsed.data.sector,
      status: "draft",
      document: parsed.data as unknown as Prisma.InputJsonValue,
      organizationId,
    },
  });
}
