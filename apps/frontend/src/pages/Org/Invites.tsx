import { useState, type FormEvent } from "react";
import { ApiError, api, type Role } from "../../lib/api";
import { message, useLoad } from "../../lib/use";
import { useLive } from "../../lib/ws";
import { TopStrip } from "../../chrome";
import { Box, Button, EmptySheet, Icon, Input, Notice, Plotting, Stamp } from "../../ui";
import { useOrg } from "./context";

function inviteError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404)
      return "No account uses that email yet. They have to sign up before they can be invited.";
    if (error.message.startsWith("invite alredy"))
      return "That person already has a pending invite here.";
    if (error.message.startsWith("user is already"))
      return "They are already in this organisation.";
  }
  return message(error);
}

export function Invites() {
  const { org, isAdmin } = useOrg();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const pending = useLoad(
    () => (isAdmin ? api.invitesOut(org.id) : Promise.resolve([])),
    [org.id, isAdmin],
  );
  useLive(["invite:updated"], pending.reload);

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSent("");
    try {
      await api.invite(org.id, email.trim(), role);
      setSent(`Invite sent to ${email.trim()}.`);
      setEmail("");
      pending.reload();
    } catch (caught) {
      setError(inviteError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <TopStrip over={org.name} title="Invites" to={`/org/${org.id}`} />
        <main className="max-w-2xl px-5 py-8 sm:px-7">
          <EmptySheet title="Admins send the invites">
            Only an admin of {org.name} can invite people or see who has been invited.
            Invites you receive appear on your own register.
          </EmptySheet>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopStrip over={org.name} title="Invites" to={`/org/${org.id}`} />

      <main className="max-w-3xl px-5 py-8 sm:px-7">
        <form onSubmit={send} className="pen-1 border-faint p-5">
          <h2 className="stencil-wide text-[1.15rem] leading-tight text-line">
            Invite somebody
          </h2>
          <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-faint">
            The invite goes to an account that already exists, by email. There is no
            email delivery and no signup-by-link, so they will see it on their own
            register the next time they look.
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <Input
              id="invite-email"
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@studio.com"
              className="min-w-[14rem] flex-1"
            />
            <Box label="Role" htmlFor="invite-role">
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="stencil bg-transparent px-3 pt-4 pb-2.5 text-[11px] text-line outline-none"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </Box>
            <Button type="submit" tone="stamp" busy={busy} disabled={!email.trim()} className="py-2.5">
              Send invite
            </Button>
          </div>

          {error ? <Notice className="mt-4">{error}</Notice> : null}
          {sent ? (
            <Notice kind="note" className="mt-4">
              {sent}
            </Notice>
          ) : null}
        </form>

        <section className="mt-10">
          <h2 className="stencil pen-b-0 border-rule pb-3 text-[11px] text-line">
            Pending{" "}
            <span className="text-faint">
              {String(pending.data?.length ?? 0).padStart(2, "0")}
            </span>
          </h2>

          {pending.loading && !pending.data ? (
            <p className="mt-5 flex items-center gap-3 stencil text-[10px] text-faint">
              <Plotting /> Reading invites
            </p>
          ) : pending.error ? (
            <div className="mt-5 flex flex-col gap-3">
              <Notice>{pending.error}</Notice>
              <Notice kind="note">
                The invites table comes from <code>002_invitesTable.sql</code>. If that
                migration has not run, run <code>bun run migrate</code> in{" "}
                <code>apps/backend</code> and reload.
              </Notice>
            </div>
          ) : (pending.data ?? []).length === 0 ? (
            <div className="mt-5">
              <EmptySheet title="Nothing pending">
                Everyone invited has either accepted or declined.
              </EmptySheet>
            </div>
          ) : (
            <ul className="mt-5 flex list-none flex-col gap-px bg-rule p-0 pen-0 border-rule">
              {(pending.data ?? []).map((invite) => (
                <li key={invite.id} className="flex items-center gap-4 bg-field px-4 py-3.5">
                  <Stamp email={invite.email} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-line">{invite.email}</p>
                    <p className="stencil mt-1 text-[9px] text-faint">
                      Invite {String(invite.id).padStart(3, "0")} · awaiting reply
                    </p>
                  </div>
                  <Button
                    tone="ghost"
                    busy={cancelling === invite.id}
                    onClick={async () => {
                      setCancelling(invite.id);
                      setError("");
                      try {
                        await api.deleteInvite(invite.id);
                        pending.reload();
                      } catch (caught) {
                        setError(message(caught));
                      } finally {
                        setCancelling(null);
                      }
                    }}
                  >
                    <Icon name="close" size={13} />
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
