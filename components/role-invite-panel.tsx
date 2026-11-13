"use client";

import { useCallback, useEffect, useState } from "react";
import { FlashCard } from "@/components/page-frame";
import Link from "next/link";
import { LinkSharePanel } from "@/components/qr-share";

type Invite = {
  id: string;
  playbookRoleId: string | null;
  roleName: string;
  teamId: string | null;
  teamName: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  status: string;
  tokenHint: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  lastSentAt: string | null;
  deliveryError: string | null;
  claimedAt: string | null;
  claimedBy: { id: string; name: string; email: string } | null;
  ready: boolean;
};

type Data = {
  invites: Invite[];
  roles: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  coverage: {
    roleId: string;
    roleName: string;
    filled: boolean;
    configured: boolean;
  }[];
  allRolesFilled: boolean;
  allRolesConfigured: boolean;
};

export function RoleInvitePanel({
  sessionId,
  onChanged,
  embedded = false,
}: {
  sessionId: string;
  onChanged?: () => Promise<void> | void;
  embedded?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qrByInvite, setQrByInvite] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/sessions/${sessionId}/role-invites`);
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Could not load invitations");
      return;
    }
    setData(json);
  }, [sessionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load resolves asynchronously
    void load();
  }, [load]);

  async function mutate(
    method: "POST" | "PATCH" | "DELETE",
    body?: object,
    query = "",
  ) {
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/sessions/${sessionId}/role-invites${query}`,
      {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error ?? "Invitation action failed");
    }
    await load();
    await onChanged?.();
    return json;
  }

  async function createSlot(ensureAll = false) {
    setBusyId("create");
    try {
      const taken = new Set(
        (data?.invites ?? [])
          .map((invite) => invite.playbookRoleId)
          .filter((id): id is string => Boolean(id)),
      );
      const nextRole =
        data?.roles.find((role) => !taken.has(role.id))?.id ??
        data?.roles[0]?.id;
      await mutate("POST", {
        ensureAll,
        ...(!ensureAll && nextRole ? { playbookRoleId: nextRole } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create slot");
    } finally {
      setBusyId(null);
    }
  }

  async function updateSlot(inviteId: string, patch: object) {
    setBusyId(inviteId);
    try {
      await mutate("PATCH", { inviteId, action: "update", ...patch });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update slot");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function copyFreshLink(inviteId: string) {
    setBusyId(inviteId);
    try {
      const json = await mutate("PATCH", { inviteId, action: "issue" });
      await navigator.clipboard.writeText(json.link);
      setQrByInvite((prev) => ({ ...prev, [inviteId]: json.link as string }));
      setNotice("A fresh 72-hour link was generated and copied.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not issue link");
    } finally {
      setBusyId(null);
    }
  }

  async function showInviteQr(inviteId: string) {
    setBusyId(inviteId);
    try {
      const json = await mutate("PATCH", { inviteId, action: "issue" });
      setQrByInvite((prev) => ({ ...prev, [inviteId]: json.link as string }));
      setNotice("Scan the QR with a phone to open this role invite.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not issue link");
    } finally {
      setBusyId(null);
    }
  }

  async function send(inviteId?: string) {
    setBusyId(inviteId ?? "send-all");
    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/sessions/${sessionId}/role-invites/email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteId ? { inviteId } : { sendAll: true }),
      },
    );
    const json = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(json.error ?? "Could not send invitation");
      return;
    }
    setNotice(
      inviteId
        ? "Invitation email sent."
        : `${json.sent ?? 0} invitation email(s) sent.`,
    );
    await load();
  }

  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">Invitation assignments</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Recipient + role + squad are locked into each passwordless link. Email
            sending uses{" "}
            <Link href="/settings/email" className="text-primary-hover underline">
              Settings → Email (SMTP)
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn btn-ghost h-8 px-2.5 text-[11px]"
            disabled={busyId !== null || !data?.roles.length}
            onClick={() => void createSlot()}
          >
            Add slot
          </button>
          <button
            type="button"
            className="btn btn-ghost h-8 px-2.5 text-[11px]"
            disabled={busyId !== null}
            onClick={() => void createSlot(true)}
          >
            Fill missing
          </button>
        </div>
      </div>

      {data ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.coverage.map((item) => (
            <span
              key={item.roleId}
              className={`chip h-6 px-2 text-[10px] ${
                item.filled
                  ? "chip-on"
                  : item.configured
                    ? "status-warning"
                    : ""
              }`}
            >
              {item.roleName}:{" "}
              {item.filled ? "seated" : item.configured ? "assigned" : "missing"}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {!data ? (
          <p className="text-[12px] text-muted">Loading assignments…</p>
        ) : data.invites.filter((invite) => invite.status !== "REVOKED").length ===
          0 ? (
          <div className="glass-inset rounded-[var(--radius-control)] px-3 py-3.5 text-[12px] text-muted">
            Add a slot or create one for every missing scenario role.
          </div>
        ) : (
          data.invites
            .filter((invite) => invite.status !== "REVOKED")
            .map((invite) => {
              const takenByOthers = new Set(
                data.invites
                  .filter(
                    (other) =>
                      other.id !== invite.id &&
                      other.status !== "REVOKED" &&
                      other.playbookRoleId,
                  )
                  .map((other) => other.playbookRoleId as string),
              );
              const roleOptions = data.roles.filter(
                (role) =>
                  role.id === invite.playbookRoleId ||
                  !takenByOthers.has(role.id),
              );
              return (
              <div
                key={invite.id}
                className="glass-inset rounded-[var(--radius-control)] p-2.5"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="field h-9 px-2.5 text-[12px]"
                    defaultValue={invite.recipientName ?? ""}
                    placeholder="Participant name"
                    disabled={Boolean(invite.claimedAt) || busyId === invite.id}
                    onBlur={(event) =>
                      void updateSlot(invite.id, {
                        recipientName: event.currentTarget.value || null,
                      })
                    }
                  />
                  <input
                    type="email"
                    className="field h-9 px-2.5 text-[12px]"
                    defaultValue={invite.recipientEmail ?? ""}
                    placeholder="participant@example.com"
                    disabled={Boolean(invite.claimedAt) || busyId === invite.id}
                    onBlur={(event) =>
                      void updateSlot(invite.id, {
                        recipientEmail: event.currentTarget.value || null,
                      })
                    }
                  />
                  <select
                    className="field h-9 px-2 text-[12px]"
                    value={invite.playbookRoleId ?? ""}
                    disabled={Boolean(invite.claimedAt) || busyId === invite.id}
                    onChange={(event) =>
                      void updateSlot(invite.id, {
                        playbookRoleId: event.currentTarget.value,
                      })
                    }
                  >
                    <option value="">Choose scenario role</option>
                    {roleOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field h-9 px-2 text-[12px]"
                    value={invite.teamId ?? ""}
                    disabled={Boolean(invite.claimedAt) || busyId === invite.id}
                    onChange={(event) =>
                      void updateSlot(invite.id, {
                        teamId: event.currentTarget.value || null,
                      })
                    }
                  >
                    <option value="">
                      {data.teams.length ? "Choose squad" : "No squads required"}
                    </option>
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-meta">
                    {invite.claimedAt
                      ? `Claimed by ${invite.claimedBy?.name ?? "participant"}`
                      : invite.status === "SENT"
                        ? `Sent${invite.tokenHint ? ` · •••${invite.tokenHint}` : ""}`
                        : invite.ready
                          ? "Ready to issue"
                          : "Needs assignment"}
                  </span>
                  {!invite.claimedAt ? (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="btn btn-ghost h-7 px-2 text-[10px]"
                        disabled={!invite.ready || busyId !== null}
                        onClick={() => void copyFreshLink(invite.id)}
                      >
                        {invite.tokenHint ? "Rotate + copy" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost h-7 px-2 text-[10px]"
                        disabled={!invite.ready || busyId !== null}
                        onClick={() => void showInviteQr(invite.id)}
                      >
                        {qrByInvite[invite.id] ? "Refresh QR" : "Show QR"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost h-7 px-2 text-[10px]"
                        disabled={!invite.ready || busyId !== null}
                        onClick={() => void send(invite.id)}
                      >
                        {invite.sentAt ? "Resend" : "Email"}
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-danger"
                        disabled={busyId !== null}
                        onClick={async () => {
                          setBusyId(invite.id);
                          try {
                            await mutate(
                              "DELETE",
                              undefined,
                              `?inviteId=${encodeURIComponent(invite.id)}`,
                            );
                          } catch (cause) {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : "Could not revoke",
                            );
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ) : null}
                </div>
                {qrByInvite[invite.id] ? (
                  <div className="mt-2 flex justify-center border-t border-border-soft pt-2">
                    <LinkSharePanel
                      title={`${invite.roleName || "Role"} invite`}
                      hint="Passwordless seat · phone scan or copy"
                      url={qrByInvite[invite.id]}
                      size={120}
                    />
                  </div>
                ) : null}
                {invite.deliveryError ? (
                  <p className="mt-2 text-[11px] text-danger">
                    Delivery: {invite.deliveryError}
                  </p>
                ) : null}
              </div>
              );
            })
        )}
      </div>

      {data?.invites.some(
        (invite) => invite.ready && !invite.claimedAt && invite.status !== "REVOKED",
      ) ? (
        <button
          type="button"
          className="btn btn-primary mt-3 w-full"
          disabled={busyId !== null}
          onClick={() => void send()}
        >
          {busyId === "send-all" ? "Sending…" : "Send all ready"}
        </button>
      ) : null}
      {notice ? <p className="mt-2 text-[11px] text-success">{notice}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-danger">{error}</p> : null}
    </>
  );

  return embedded ? (
    <div>{content}</div>
  ) : (
    <FlashCard className="p-4 sm:p-5">{content}</FlashCard>
  );
}
