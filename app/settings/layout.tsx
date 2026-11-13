import { DeskShell } from "@/components/desk-shell";
import { PageFrame } from "@/components/page-frame";
import { SettingsNav } from "@/components/settings-nav";
import { PageHero } from "@/components/ui-kit";
import { requirePageAdmin } from "@/lib/access";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAdmin();

  return (
    <DeskShell>
      <PageFrame className="gap-5">
        <PageHero
          variant="admin"
          eyebrow="Admin"
          title="Settings"
          description="AI credentials, email delivery, capacity, and IRP/CCMP upload retention. Field colour lives on the sun/moon control in the rail."
        />
        <div className="grid items-start gap-5 lg:grid-cols-[196px_minmax(0,1fr)]">
          <div className="min-w-0 lg:sticky lg:top-0">
            <SettingsNav />
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </PageFrame>
    </DeskShell>
  );
}
