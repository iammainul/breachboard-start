import { notFound } from "next/navigation";
import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { ScenarioEditor } from "@/components/scenario-editor";
import { isAdmin, requirePageOperator } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import { persistStageAssets } from "@/lib/media/persist-stage-assets";
import { canAccessOrganization, listVisibleOrganizations } from "@/lib/org-scope";

export default async function ScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageOperator();
  const { id } = await params;
  const [exercise, organizations] = await Promise.all([
    prisma.exercise.findUnique({ where: { id } }),
    listVisibleOrganizations(user),
  ]);
  if (!exercise) notFound();
  if (exercise.organizationId) {
    if (!(await canAccessOrganization(user, exercise.organizationId))) notFound();
  } else if (!isAdmin(user)) {
    notFound();
  }
  const parsed = parseExerciseDocument(exercise.document);
  if (!parsed.success) notFound();
  const document =
    exercise.status === "draft"
      ? ((await persistStageAssets(exercise.id)) ?? parsed.data)
      : parsed.data;

  return (
    <DeskShell>
      <PageFrame className="xl:h-full">
        <ScenarioEditor
          id={exercise.id}
          initial={document}
          status={exercise.status}
          lineageKey={exercise.lineageKey}
          organizations={organizations.map((o) => ({
            id: o.id,
            name: o.name,
          }))}
        />
      </PageFrame>
    </DeskShell>
  );
}
