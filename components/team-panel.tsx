"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FlashCard } from "@/components/page-frame";
import { LinkSharePanel } from "@/components/qr-share";
import { PresenceBadge } from "@/components/game-ui";

type Team = { id: string; name: string; memberUserIds: string[] };
type Seat = {
  id: string;
  kind: string;
  playbookRoleId?: string | null;
  teamId?: string | null;
  user: { id: string; name: string; email: string };
  presence?: "online" | "waiting" | "left";
};
type Role = { id: string; name: string };
type InviteRow = {
  id: string;
  playbookRoleId: string | null;
  roleName: string;
  teamId: string | null;
  recipientEmail: string | null;
  status: string;
  claimedAt: string | null;
  ready: boolean;
};

/**
 * Teams + passwordless onboard links for seated players.
 * Squad code / lobby QR stays on the header badge — not duplicated here.
 */
export function TeamPanel({
  sessionId,
  teams,
  seats,
  roles = [],
  onDone,
  embedded = false,
}: {
  sessionId: string;
  /** @deprecated Lobby QR lives on Squad code badge — ignored. */
  joinCode?: string;
  teams: Team[];
  seats: Seat[];
  roles?: Role[];
  onDone: () => Promise<void>;
  embedded?: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [qrByKey, setQrByKey] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const participants = seats.filter((s) => s.kind === "PARTICIPANT");

  const roleName = useCallback(
    (roleId: string | null | undefined) =>
      roleId ? roles.find((r) => r.id === roleId)?.name ?? roleId : "Unassigned",
    [roles],
  );

  const loadInvites = useCallback(async () => {
    const response = await fetch(`/api/sessions/${sessionId}/role-invites`);
    if (!response.ok) return;
    const json = await response.json();
    setInvites(
      (json.invites as InviteRow[]).filter((i) => i.status !== "REVOKED"),
    );
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load resolves asynchronously
    void loadInvites();
  }, [loadInvites]);

  const inviteForSeat = useMemo(() => {
    const map = new Map<string, InviteRow>();
    for (const seat of participants) {
      const email = seat.user.email?.trim().toLowerCase();
      const match =
        invites.find(
          (inv) =>
            !inv.claimedAt &&
            inv.recipientEmail?.toLowerCase() === email &&
            inv.playbookRoleId === seat.playbookRoleId,
        ) ??
        invites.find(
          (inv) =>
            !inv.claimedAt &&
            inv.playbookRoleId === seat.playbookRoleId &&
            (!seat.teamId || inv.teamId === seat.teamId),
        );
      if (match) map.set(seat.user.id, match);
    }
    return map;
  }, [invites, participants]);

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Could not create team");
      return;
    }
    setName("");
    await onDone();
  }

  async function setMembers(teamId: string, userIds: string[]) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}/teams`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, userIds }),
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(json.error ?? "Could not update team");
      return;
    }
    await onDone();
  }

  async function removeTeam(teamId: string) {
    setBusy(true);
    await fetch(`/api/sessions/${sessionId}/teams?teamId=${teamId}`, {
      method: "DELETE",
    });
    setBusy(false);
    await onDone();
  }

  /** Issue passwordless /invite/{token} bound to this seat's role + squad. */
  async function issueOnboardLink(seat: Seat, showQr: boolean) {
    if (!seat.playbookRoleId) {
      setError("Assign a playbook role on the seat first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let inviteId = inviteForSeat.get(seat.user.id)?.id;
      if (!inviteId) {
        const create = await fetch(`/api/sessions/${sessionId}/role-invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playbookRoleId: seat.playbookRoleId,
            teamId: seat.teamId ?? null,
            recipientEmail: seat.user.email,
            recipientName: seat.user.name,
          }),
        });
        const created = await create.json();
        if (!create.ok && create.status !== 409) {
          throw new Error(created.error ?? "Could not create invite");
        }
        const list = await fetch(`/api/sessions/${sessionId}/role-invites`);
        const payload = await list.json();
        const rows = (payload.invites as InviteRow[]).filter(
          (inv) => inv.status !== "REVOKED" && !inv.claimedAt,
        );
        setInvites(rows);
        const email = seat.user.email.trim().toLowerCase();
        const found =
          rows.find(
            (inv) =>
              inv.recipientEmail?.toLowerCase() === email &&
              inv.playbookRoleId === seat.playbookRoleId,
          ) ?? rows.find((inv) => inv.playbookRoleId === seat.playbookRoleId);
        inviteId = found?.id;
      } else {
        await fetch(`/api/sessions/${sessionId}/role-invites`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteId,
            action: "update",
            recipientEmail: seat.user.email,
            recipientName: seat.user.name,
            teamId: seat.teamId ?? null,
            playbookRoleId: seat.playbookRoleId,
          }),
        });
      }
      if (!inviteId) throw new Error("Invite slot missing");

      const issue = await fetch(`/api/sessions/${sessionId}/role-invites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action: "issue" }),
      });
      const issued = await issue.json();
      if (!issue.ok) throw new Error(issued.error ?? "Could not issue link");
      const link = issued.link as string;
      setQrByKey((prev) => ({ ...prev, [seat.user.id]: link }));
      await navigator.clipboard.writeText(link);
      setCopiedKey(`onboard-${seat.user.id}`);
      setNotice(
        showQr
          ? `Onboard QR ready for ${seat.user.name} (${roleName(seat.playbookRoleId)}). No login required.`
          : `Onboard link copied for ${seat.user.name} → opens their ${roleName(seat.playbookRoleId)} seat (no account).`,
      );
      window.setTimeout(() => setCopiedKey(null), 2000);
      await loadInvites();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <>
      <h2 className="text-[15px] font-semibold">Teams (this run)</h2>
      <p className="text-[12px] text-muted">
        Squad code stays in the header. Here: passwordless onboard links that open
        each player’s assigned role — no account or login.
      </p>
      <p className="text-[11px] text-meta">
        Email delivery:{" "}
        <Link href="/settings/email" className="text-primary-hover underline">
          Settings → Email (SMTP)
        </Link>
      </p>

      <div className="glass-inset rounded-[var(--radius)] px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
          Role onboard links
        </div>
        <p className="mt-1 text-[12px] text-muted">
          Copy link or show QR — phone/browser opens /invite/… and seats that role
          only. One active device session per player.
        </p>
        <ul className="glass-scroll mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {participants.map((seat) => {
            const key = `onboard-${seat.user.id}`;
            return (
              <li
                key={seat.id}
                className="glass-tile flex flex-wrap items-center justify-between gap-1 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[12px] font-medium">
                      {seat.user.name}
                    </span>
                    <PresenceBadge status={seat.presence ?? "waiting"} />
                  </div>
                  <div className="truncate text-[10px] text-meta">
                    {roleName(seat.playbookRoleId)} · {seat.user.email}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost h-7 px-2 text-[10px]"
                    disabled={busy || !seat.playbookRoleId}
                    onClick={() => void issueOnboardLink(seat, false)}
                  >
                    {copiedKey === key ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost h-7 px-2 text-[10px]"
                    disabled={busy || !seat.playbookRoleId}
                    onClick={() => void issueOnboardLink(seat, true)}
                  >
                    {qrByKey[seat.user.id] ? "Refresh QR" : "Show QR"}
                  </button>
                </div>
                {qrByKey[seat.user.id] ? (
                  <div className="mt-1 w-full border-t border-border-soft pt-2">
                    <LinkSharePanel
                      title={`${roleName(seat.playbookRoleId)} · ${seat.user.name}`}
                      hint="Passwordless onboard — no login"
                      url={qrByKey[seat.user.id]}
                      size={108}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
          {participants.length === 0 ? (
            <li className="text-[12px] text-meta">Seat participants first.</li>
          ) : null}
        </ul>
      </div>

      <form onSubmit={createTeam} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field"
          placeholder="e.g. Legal / Blue Team"
        />
        <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary shrink-0">
          Add
        </button>
      </form>
      {teams.length === 0 ? (
        <p className="text-[13px] text-muted">
          No teams yet — without teams, all seated participants stay active (legacy mode).
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {teams.map((team) => (
            <li
              key={team.id}
              className="glass-inset rounded-[var(--radius)] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-[14px]">{team.name}</div>
                <button
                  type="button"
                  className="text-[12px] text-muted hover:text-danger"
                  disabled={busy}
                  onClick={() => void removeTeam(team.id)}
                >
                  Remove
                </button>
              </div>
              <div className="glass-scroll mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-0.5">
                {participants.map((seat) => {
                  const checked = team.memberUserIds.includes(seat.user.id);
                  return (
                    <label
                      key={seat.id}
                      className="flex items-center gap-2 text-[13px] text-fg-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...new Set([...team.memberUserIds, seat.user.id])]
                            : team.memberUserIds.filter((id) => id !== seat.user.id);
                          void setMembers(team.id, next);
                        }}
                      />
                      <span className="min-w-0 truncate">
                        {seat.user.name}
                        <span className="text-meta">
                          {" "}
                          · {roleName(seat.playbookRoleId)}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {participants.length === 0 ? (
                  <span className="text-[12px] text-meta">Seat participants first.</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {notice ? <p className="text-[12px] text-success">{notice}</p> : null}
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
    </>
  );

  return embedded ? (
    <div className="flex flex-col gap-3">{content}</div>
  ) : (
    <FlashCard className="flex flex-col gap-3 p-4 sm:p-5">{content}</FlashCard>
  );
}
