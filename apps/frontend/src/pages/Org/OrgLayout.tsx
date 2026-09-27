import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { OrgContext } from "./context";
import { useLoad } from "../../lib/use";
import { live, useLive } from "../../lib/ws";
import { Icon, Notice, Plotting } from "../../ui";

function RailLink({
  to,
  end,
  icon,
  children,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  icon: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        "stencil mx-2 flex items-center gap-2.5 px-3 py-2.5 text-[10px] no-underline transition-colors " +
        (isActive
          ? "pen-0 border-line bg-raise text-line"
          : "pen-0 border-transparent text-faint hover:bg-raise hover:text-line")
      }
    >
      <Icon name={icon} size={14} />
      {children}
    </NavLink>
  );
}

export function OrgLayout() {
  const { orgId } = useParams();
  const id = Number(orgId);
  const [railOpen, setRailOpen] = useState(false);

  const orgs = useLoad(() => api.orgs(), [id]);
  const boards = useLoad(() => api.boards(id), [id]);
  const members = useLoad(() => api.members(id), [id]);

  useEffect(() => {
    live.joinOrg(Number.isFinite(id) ? id : null);
    return () => live.joinOrg(null);
  }, [id]);

  useLive(["board:updated"], boards.reload);
  useLive(["membership:updated", "membership:role_changed"], () => {
    members.reload();
    orgs.reload();
  });
  useLive(["org:updated"], orgs.reload);

  if (!Number.isFinite(id)) return <Navigate to="/dashboard" replace />;

  const org = orgs.data?.find((candidate) => candidate.id === id) ?? null;

  if (orgs.loading && !orgs.data) {
    return (
      <p className="flex items-center gap-3 p-8 stencil text-[10px] text-faint">
        <Plotting /> Opening organisation
      </p>
    );
  }

  if (orgs.error) {
    return (
      <div className="max-w-xl p-8">
        <Notice>{orgs.error}</Notice>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="max-w-xl p-8">
        <h1 className="stencil-wide text-[1.6rem] text-line">Not your organisation</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-faint">
          Organisation {id} is not one you belong to, or it no longer exists. Ask an
          admin for an invite.
        </p>
        <Link
          to="/dashboard"
          className="stencil mt-6 inline-flex items-center gap-2 pen-1 border-line px-3 py-1.5 text-[11px] text-line no-underline"
        >
          <Icon name="left" size={13} />
          Back to the register
        </Link>
      </div>
    );
  }

  const context: OrgContext = {
    org,
    role: org.role,
    isAdmin: org.role === "admin",
    boards: boards.data ?? [],
    reloadBoards: boards.reload,
    members: members.data ?? [],
    reloadMembers: members.reload,
  };

  const close = () => setRailOpen(false);

  return (
    <div className="flex min-h-screen">
      <button
        onClick={() => setRailOpen(true)}
        aria-label="Open organisation menu"
        className="fixed bottom-4 left-4 z-40 bg-field p-3 pen-2 border-line text-line lg:hidden"
      >
        <Icon name="right" />
      </button>

      {railOpen ? (
        <div
          className="fixed inset-0 z-40 bg-sink/70 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      ) : null}

      <nav
        aria-label="Organisation"
        className={
          "fixed inset-y-0 left-0 z-40 flex w-[17rem] shrink-0 flex-col overflow-y-auto bg-field pen-r-2 border-line transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 " +
          (railOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="pen-b-0 border-rule px-4 py-4">
          <Link
            to="/dashboard"
            onClick={close}
            className="stencil flex items-center gap-1.5 text-[9px] text-faint no-underline hover:text-line"
          >
            <Icon name="left" size={12} />
            Register
          </Link>
          <h2 className="stencil-wide mt-2 text-[1.3rem] leading-tight text-line">{org.name}</h2>
          <p className="stencil mt-2 text-[9px] text-faint">
            You are{" "}
            <span className={org.role === "admin" ? "text-stamp" : "text-line"}>{org.role}</span>
          </p>
        </div>

        <div className="py-3">
          <p className="stencil px-4 pb-2 text-[9px] text-rule">Boards</p>
          {boards.loading && !boards.data ? (
            <p className="px-4 py-2 text-[12px] text-faint">Reading…</p>
          ) : boards.error ? (
            <p className="px-4 py-2 text-[12px] text-redink">{boards.error}</p>
          ) : context.boards.length === 0 ? (
            <p className="px-4 py-2 text-[12px] leading-relaxed text-faint">
              No boards yet.
            </p>
          ) : (
            context.boards.map((board) => (
              <RailLink
                key={board.id}
                to={`/org/${id}/board/${board.id}`}
                icon="sheet"
                onNavigate={close}
              >
                <span className="truncate normal-case tracking-normal [font-stretch:100%]">
                  {board.title}
                </span>
              </RailLink>
            ))
          )}
          <RailLink to={`/org/${id}`} end icon="sheet" onNavigate={close}>
            All boards
          </RailLink>
        </div>

        <div className="mt-auto pen-t-0 border-rule py-3">
          <RailLink to={`/org/${id}/members`} icon="people" onNavigate={close}>
            Membership
          </RailLink>
          <RailLink to={`/org/${id}/invites`} icon="envelope" onNavigate={close}>
            Invites
          </RailLink>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <Outlet context={context} />
      </div>
    </div>
  );
}
