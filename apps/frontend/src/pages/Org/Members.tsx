import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, session, type Member, type Role } from "../../lib/api";
import { message } from "../../lib/use";
import { Search, TopStrip } from "../../chrome";
import { Button, EmptySheet, Icon, Notice, Plotting, Stamp } from "../../ui";
import { useConfirm } from "../../lib/confirm";
import { useOrg } from "./context";

export function Members() {
  const { org, isAdmin, members, reloadMembers } = useOrg();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const { confirm, confirmNode } = useConfirm();
  const navigate = useNavigate();
  const me = session.userId;

  const needle = query.trim().toLowerCase();
  const shown = members.filter((m) => !needle || m.email.toLowerCase().includes(needle));
  const admins = members.filter((m) => m.role === "admin").length;

  async function act(id: number, work: () => Promise<unknown>) {
    setBusyId(id);
    setError("");
    try {
      await work();
      reloadMembers();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusyId(null);
    }
  }

  function setRole(member: Member, role: Role) {
    if (member.role === "admin" && role === "member" && admins === 1) {
      setError("This is the only admin. Promote someone else first.");
      return;
    }
    act(member.id, () => api.setRole(org.id, member.id, role));
  }

  return (
    <div className="min-h-screen">
      <TopStrip over={org.name} title="Membership" to={`/org/${org.id}`}>
        <Search value={query} onChange={setQuery} placeholder="Filter people" />
      </TopStrip>

      <main className="max-w-4xl px-5 py-8 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-4 pen-b-0 border-rule pb-3">
          <h2 className="stencil text-[11px] text-line">
            On this organisation{" "}
            <span className="text-faint">{String(members.length).padStart(2, "0")}</span>
          </h2>
          <p className="stencil text-[9px] text-faint">
            {admins} admin{admins === 1 ? "" : "s"} · {members.length - admins} member
            {members.length - admins === 1 ? "" : "s"}
          </p>
        </div>

        {error ? <Notice className="mt-4">{error}</Notice> : null}

        {members.length === 0 ? (
          <p className="mt-6 flex items-center gap-3 stencil text-[10px] text-faint">
            <Plotting /> Reading membership
          </p>
        ) : shown.length === 0 ? (
          <div className="mt-6">
            <EmptySheet title="Nobody matches that filter" />
          </div>
        ) : (
          <ul className="mt-6 flex list-none flex-col gap-px bg-rule p-0 pen-0 border-rule">
            {shown.map((member) => {
              const mine = member.id === me;
              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-4 bg-field px-4 py-3.5"
                >
                  <Stamp email={member.email} role={member.role} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-line">
                      {member.email}
                      {mine ? <span className="ml-2 stencil text-[9px] text-faint">you</span> : null}
                    </p>
                    <p className="stencil mt-1 text-[9px] text-faint">
                      User {String(member.id).padStart(3, "0")} ·{" "}
                      <span className={member.role === "admin" ? "text-stamp" : ""}>
                        {member.role}
                      </span>
                    </p>
                  </div>

                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`role-${member.id}`}>
                        Role for {member.email}
                      </label>
                      <select
                        id={`role-${member.id}`}
                        value={member.role}
                        disabled={busyId === member.id}
                        onChange={(e) => setRole(member, e.target.value as Role)}
                        className="stencil bg-field px-2 py-1.5 pen-0 border-rule text-[10px] text-line outline-none transition-colors hover:border-line focus:border-line disabled:text-rule"
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                      {!mine ? (
                        <button
                          aria-label={`Remove ${member.email}`}
                          disabled={busyId === member.id}
                          onClick={() =>
                            confirm({
                              title: "Remove from organisation",
                              verb: "Remove",
                              body: (
                                <>
                                  <strong className="text-line">{member.email}</strong> loses
                                  access to every board here. Their issues and comments stay.
                                </>
                              ),
                              run: () => act(member.id, () => api.kick(org.id, member.id)),
                            })
                          }
                          className="p-2 pen-0 border-rule text-faint transition-colors hover:border-redline hover:text-redink disabled:text-rule"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <span
                      className={
                        "stencil px-2 py-1 text-[9px] " +
                        (member.role === "admin" ? "pen-0 border-stamp text-stamp" : "text-faint")
                      }
                    >
                      {member.role}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-10 pen-t-0 border-rule pt-5">
          <h3 className="stencil text-[10px] text-faint">Your membership</h3>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-faint">
            Leaving removes only you. An organisation must keep at least one admin, so
            if you are the last one you will need to promote somebody first.
          </p>
          <Button
            tone="redline"
            className="mt-4"
            onClick={() =>
              confirm({
                title: "Leave organisation",
                verb: "Leave",
                body: (
                  <>
                    You will lose access to every board in{" "}
                    <strong className="text-line">{org.name}</strong> until somebody
                    invites you back.
                  </>
                ),
                run: async () => {
                  setError("");
                  try {
                    await api.leaveOrg(org.id);
                    navigate("/dashboard", { replace: true });
                  } catch (caught) {
                    setError(message(caught));
                  }
                },
              })
            }
          >
            <Icon name="out" size={13} />
            Leave {org.name}
          </Button>
        </div>
      </main>

      {confirmNode}
    </div>
  );
}
