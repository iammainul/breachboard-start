"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FieldLabel, FormCard } from "@/components/ui-kit";
import { GlassDropdown } from "@/components/glass-dropdown";
import { OrgAssignPicker } from "@/components/org-assign-picker";

type Org = { id: string; name: string };

export function UserCreateForm({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [platformRole, setPlatformRole] = useState("USER");
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(null);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        platformRole: String(formData.get("platformRole") ?? "USER"),
        canFacilitate: true,
        organizationId: String(formData.get("organizationId") ?? "") || null,
        organizationIds: formData.getAll("organizationIds").map(String).filter(Boolean),
      }),
    });
    const json = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(json.error ?? "Could not create operator");
      return;
    }
    form.reset();
    setPlatformRole("USER");
    setFormKey((key) => key + 1);
    router.refresh();
  }

  return (
    <FormCard
      title="Create operator"
      description="Desk logins for admins and facilitators only. Participants enter with a join code or invite link — no account."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <FieldLabel label="Full name">
          <input
            name="name"
            required
            autoComplete="name"
            className="field pr-10"
            placeholder="Priya Shah"
          />
        </FieldLabel>
        <FieldLabel label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field"
          />
        </FieldLabel>
        <FieldLabel label="Password" hint="Required — at least 8 characters">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="field pr-10"
          />
        </FieldLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GlassDropdown
            label="Desk role"
            name="platformRole"
            value={platformRole}
            onChange={(next) =>
              setPlatformRole(typeof next === "string" ? next : next[0] ?? "USER")
            }
            options={[
              { value: "USER", label: "Facilitator" },
              { value: "ADMIN", label: "Admin" },
            ]}
          />
          <OrgAssignPicker
            key={formKey}
            organizations={organizations}
            hint="Facilitators only see these organizations on the desk. Admins always see every client."
          />
        </div>
        {error ? (
          <p className="rounded-[var(--radius-control)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-50">
          {pending ? "Creating…" : "Create operator"}
        </button>
      </form>
    </FormCard>
  );
}
