import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { LibraryCloneCard } from "@/components/library-clone-card";
import { LibraryPackToolbar } from "@/components/library-pack-toolbar";
import { EmptyState, FilterChips, PageHero, ShieldIcon } from "@/components/ui-kit";
import { requirePageAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { seedLibraryTemplates } from "@/lib/library/seed-templates";
import { parseExerciseDocument } from "@/lib/schema/exercise";
import Link from "next/link";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; tag?: string }>;
}) {
  await requirePageAdmin();
  const { kind, tag } = await searchParams;

  let templates = await prisma.exercise.findMany({
    where: {
      isTemplate: true,
      ...(kind === "scenario_pack" || kind === "inject_pack"
        ? { libraryKind: kind }
        : {}),
      ...(tag ? { libraryTags: { has: tag } } : {}),
    },
    orderBy: { title: "asc" },
  });
  if (templates.length === 0 && !kind && !tag) {
    await seedLibraryTemplates();
    templates = await prisma.exercise.findMany({
      where: { isTemplate: true },
      orderBy: { title: "asc" },
    });
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const chips = [
    { href: "/library", label: "All", active: !kind && !tag },
    {
      href: "/library?kind=scenario_pack",
      label: "Scenario packs",
      active: kind === "scenario_pack",
    },
    {
      href: "/library?kind=inject_pack",
      label: "Inject packs",
      active: kind === "inject_pack",
    },
    { href: "/library?tag=bfsi", label: "BFSI", active: tag === "bfsi" },
    { href: "/library?tag=ransomware", label: "Ransomware", active: tag === "ransomware" },
  ];

  return (
    <DeskShell>
      <PageFrame>
        <PageHero
          variant="admin"
          eyebrow="Authoring"
          title="Scenario library"
          description="Scenario and inject packs — clone into an org, or share as .ttxpack files across installs."
          actions={
            <>
              <Link href="/generate" className="btn btn-ghost">
                Generate with AI
              </Link>
              <Link href="/settings" className="btn btn-primary">
                Settings
              </Link>
            </>
          }
        />

        <LibraryPackToolbar />

        <FilterChips items={chips} />

        {templates.length === 0 ? (
          <EmptyState
            icon={<ShieldIcon className="h-7 w-7" />}
            title="No templates in this filter"
            description="Try All, or run npm run library:seed."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {templates.map((t) => {
              const doc = parseExerciseDocument(t.document);
              return (
                <LibraryCloneCard
                  key={t.id}
                  template={{
                    key: t.templateKey ?? t.id,
                    kind: t.libraryKind,
                    title: t.title,
                    durationMin: t.durationMin,
                    sector: t.sector,
                    libraryTags: t.libraryTags,
                    coverImagePath: t.coverImagePath,
                    cloneCount: t.cloneCount,
                    injectCount: doc.success ? doc.data.injects.length : 0,
                  }}
                  organizations={organizations}
                />
              );
            })}
          </div>
        )}
      </PageFrame>
    </DeskShell>
  );
}
