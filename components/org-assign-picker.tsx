"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassDropdown } from "@/components/glass-dropdown";

export function OrgAssignPicker({
  organizations,
  name = "organizationIds",
  selectedIds,
  onChange,
  label = "Allocated clients",
  hint,
}: {
  organizations: { id: string; name: string }[];
  name?: string;
  selectedIds?: string[];
  onChange?: (ids: string[]) => void;
  label?: string;
  hint?: string;
}) {
  const [ids, setIds] = useState<string[]>(selectedIds ?? []);
  const value = selectedIds ?? ids;

  function handleChange(next: string | string[]) {
    const resolved = Array.isArray(next) ? next : next ? [next] : [];
    setIds(resolved);
    onChange?.(resolved);
  }

  return (
    <GlassDropdown
      label={label}
      multiple
      name={name}
      options={organizations.map((org) => ({ value: org.id, label: org.name }))}
      value={value}
      onChange={handleChange}
      placeholder="Select clients"
      emptyText="No clients onboarded yet."
      hint={hint}
    />
  );
}

export function OperatorClientsCell({
  userId,
  organizations,
  assignedIds,
}: {
  userId: string;
  organizations: { id: string; name: string }[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [ids, setIds] = useState(assignedIds);
  const [pending, setPending] = useState(false);

  async function save(next: string[]) {
    setIds(next);
    setPending(true);
    const response = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationIds: next }),
    });
    setPending(false);
    if (!response.ok) {
      setIds(assignedIds);
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-w-[180px]">
      <GlassDropdown
        label="Clients"
        multiple
        options={organizations.map((org) => ({ value: org.id, label: org.name }))}
        value={ids}
        onChange={(next) => void save(Array.isArray(next) ? next : [])}
        placeholder="No clients"
        disabled={pending}
      />
    </div>
  );
}
