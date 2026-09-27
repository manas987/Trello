import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type Org } from "../../lib/api";
import { message, useLoad } from "../../lib/use";
import { useLive } from "../../lib/ws";
import { Search, TopStrip } from "../../chrome";
import { Button, Dialog, EmptySheet, Icon, Input, Notice, Plotting, Textarea } from "../../ui";

function OrgSheet({ org }: { org: Org }) {
  return (
    <Link
      to={`/org/${org.id}`}
      className="group relative flex min-h-[9.5rem] flex-col justify-between bg-field pen-1 border-faint p-4 no-underline transition-all duration-150 hover:border-line hover:bg-raise focus-visible:border-line"
    >
      <div>
        <h3 className="stencil-wide text-[1.15rem] leading-tight text-line">{org.name}</h3>
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-faint">
          {org.description || "No description on this sheet."}
        </p>
      </div>
      <div className="mt-4 flex items-end justify-between pen-t-0 border-rule pt-2">
        <span className="stencil text-[9px] text-faint">
          Org <span className="text-line">{String(org.id).padStart(3, "0")}</span>
        </span>
        <span
          className={
            "stencil px-1.5 py-0.5 text-[9px] " +
            (org.role === "admin" ? "pen-1 border-stamp text-stamp" : "text-faint")
          }
        >
          {org.role}
        </span>
      </div>
    </Link>
  );
}

function NewOrg({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createOrg(name.trim(), description.trim());
      setOpen(false);
      setName("");
      setDescription("");
      onDone();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button tone="stamp" onClick={() => setOpen(true)}>
        <Icon name="plus" size={13} />
        New organisation
      </Button>
      {open ? (
        <Dialog
          title="New organisation"
          caption="You will be its admin"
          onClose={() => setOpen(false)}
        >
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Input
              id="org-name"
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Harbour Works"
            />
            <Textarea
              id="org-description"
              label="Description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this group is for. May be left blank."
            />
            {error ? <Notice>{error}</Notice> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" tone="stamp" busy={busy} disabled={!name.trim()}>
                Create
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

export function Dash() {
  const [tab, setTab] = useState<"orgs" | "invites">("orgs");
  const [query, setQuery] = useState("");
  const [acting, setActing] = useState<number | null>(null);
  const [actError, setActError] = useState("");

  const orgs = useLoad(() => api.orgs(), []);
  const invites = useLoad(() => api.invitesIn(), []);

  useLive(["membership:removed", "membership:role_changed"], orgs.reload);
  useLive(["invite:received"], invites.reload);

  const needle = query.trim().toLowerCase();
  const shownOrgs = (orgs.data ?? []).filter(
    (o) =>
      !needle ||
      o.name.toLowerCase().includes(needle) ||
      (o.description ?? "").toLowerCase().includes(needle),
  );
  const shownInvites = (invites.data ?? []).filter(
    (i) => !needle || i.name.toLowerCase().includes(needle),
  );

  async function respond(id: number, accept: boolean) {
    setActing(id);
    setActError("");
    try {
      if (accept) await api.acceptInvite(id);
      else await api.deleteInvite(id);
      invites.reload();
      if (accept) orgs.reload();
    } catch (caught) {
      setActError(message(caught));
    } finally {
      setActing(null);
    }
  }

  const tabs = [
    ["orgs", "Your organisations", orgs.data?.length],
    ["invites", "Invites", invites.data?.length],
  ] as const;

  return (
    <div className="min-h-screen">
      <TopStrip over="Blueline" title="Drawing register">
        <Search value={query} onChange={setQuery} placeholder="Filter on this page" />
      </TopStrip>

      <div className="px-5 sm:px-7">
        <div role="tablist" aria-label="Register" className="flex gap-7 pen-b-0 border-rule">
          {tabs.map(([value, label, count]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={
                "stencil -mb-px flex items-center gap-2 pb-3 pt-5 text-[11px] transition-colors " +
                (tab === value
                  ? "pen-b-2 border-line text-line"
                  : "pen-b-2 border-transparent text-faint hover:text-line")
              }
            >
              {label}
              {typeof count === "number" ? (
                <span className="text-[10px] text-faint">{String(count).padStart(2, "0")}</span>
              ) : null}
            </button>
          ))}
          <div className="ml-auto self-center pb-2">
            {tab === "orgs" ? <NewOrg onDone={orgs.reload} /> : null}
          </div>
        </div>
      </div>

      <main className="px-5 py-8 sm:px-7">
        {tab === "orgs" ? (
          orgs.loading && !orgs.data ? (
            <p className="flex items-center gap-3 stencil text-[10px] text-faint">
              <Plotting /> Reading register
            </p>
          ) : orgs.error ? (
            <Notice>{orgs.error}</Notice>
          ) : shownOrgs.length === 0 ? (
            <EmptySheet
              title={needle ? "Nothing matches that filter" : "No organisations yet"}
              action={needle ? undefined : <NewOrg onDone={orgs.reload} />}
            >
              {needle
                ? "This filters the sheets already on screen — the API has no search endpoint."
                : "An organisation owns the boards, the people and the work. Make one, or wait to be invited."}
            </EmptySheet>
          ) : (
            <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 p-0">
              {shownOrgs.map((org) => (
                <li key={org.id}>
                  <OrgSheet org={org} />
                </li>
              ))}
            </ul>
          )
        ) : invites.loading && !invites.data ? (
          <p className="flex items-center gap-3 stencil text-[10px] text-faint">
            <Plotting /> Reading invites
          </p>
        ) : invites.error ? (
          <div className="flex flex-col gap-3">
            <Notice>{invites.error}</Notice>
            <Notice kind="note">
              The invites table is created by <code>002_invitesTable.sql</code>. If that
              migration has not run yet, run <code>bun run migrate</code> in{" "}
              <code>apps/backend</code> and reload.
            </Notice>
          </div>
        ) : shownInvites.length === 0 ? (
          <EmptySheet title="No invites waiting">
            An admin invites an existing account by email. There is no signup-by-link
            flow, so the account has to exist first.
          </EmptySheet>
        ) : (
          <>
            {actError ? <Notice className="mb-4">{actError}</Notice> : null}
            <ul className="flex max-w-3xl list-none flex-col gap-px bg-rule p-0 pen-0 border-rule">
              {shownInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-4 bg-field px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="stencil-wide text-[1.05rem] leading-tight text-line">
                      {invite.name}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-faint">
                      {invite.description || "No description."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      tone="ghost"
                      busy={acting === invite.id}
                      onClick={() => respond(invite.id, false)}
                    >
                      Decline
                    </Button>
                    <Button
                      tone="stamp"
                      busy={acting === invite.id}
                      onClick={() => respond(invite.id, true)}
                    >
                      Accept
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
