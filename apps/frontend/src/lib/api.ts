
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const session = {
  get token() {
    return localStorage.getItem("token");
  },
  get email() {
    return localStorage.getItem("email") ?? "";
  },
  get userId(): number | null {
    const t = localStorage.getItem("token");
    if (!t) return null;
    try {
      const body = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return typeof body.userId === "number" ? body.userId : null;
    } catch {
      return null;
    }
  },
  open(token: string, email: string) {
    localStorage.setItem("token", token);
    localStorage.setItem("email", email);
  },
  close() {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
  },
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = session.token;
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: token } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server at " + BASE);
  }

  const text = await response.text();
  let data: { error?: string } | null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? `Request failed (${response.status})`,
    );
  }
  return data as T;
}

const query = (params: Record<string, string | number>) =>
  "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));

const get = <T,>(path: string, params?: Record<string, string | number>) =>
  call<T>(path + (params ? query(params) : ""));

const send = <T,>(method: string, path: string, body: unknown) =>
  call<T>(path, { method, body: JSON.stringify(body) });

export type Role = "admin" | "member";
export type Org = { id: number; name: string; description: string | null; role: Role };
export type Board = { id: number; title: string; orginisationid: number };
export type Section = { id: number; title: string | null; boardid: number };
export type Person = { id: number; email: string };
export type Issue = {
  id: number;
  title: string;
  description: string | null;
  sectionid: number;
  assignees: Person[];
};
export type Comment = { id: number; comment: string; userid: number };
export type Member = { id: number; email: string; role: Role };
export type InviteIn = { id: number; org_id: number; name: string; description: string | null };
export type InviteOut = { id: number; user_id: number; email: string };

export const api = {
  signup: (email: string, password: string) =>
    send<{ message: string }>("POST", "/auth/signup", { email, password }),
  signin: (email: string, password: string) =>
    send<{ token: string }>("POST", "/auth/signin", { email, password }),

  orgs: () => get<{ orgs: Org[] }>("/organization/read").then((r) => r.orgs),
  createOrg: (name: string, description: string) =>
    send("POST", "/organization/create", { name, description }),
  updateOrg: (orgid: number, patch: { name?: string; description?: string }) =>
    send("PATCH", "/organization/update", { orgid, ...patch }),
  deleteOrg: (orgid: number) => send("DELETE", "/organization/delete", { orgid }),

  boards: (orgid: number) =>
    get<{ boards: Board[] }>("/board/read", { orgid }).then((r) => r.boards),
  createBoard: (organizationId: number, name: string) =>
    send("POST", "/board/create", { name, organizationId }),
  updateBoard: (boardid: number, name: string) =>
    send("PATCH", "/board/update", { boardid, name }),
  deleteBoard: (boardid: number) => send("DELETE", "/board/delete", { boardid }),

  sections: (boardid: number) =>
    get<{ sections: Section[] }>("/section/read", { boardid }).then((r) => r.sections),
  createSection: (boardId: number, name: string) =>
    send("POST", "/section/create", { name, boardId }),
  updateSection: (sectionid: number, name: string) =>
    send("PATCH", "/section/update", { sectionid, name }),
  deleteSection: (sectionid: number) => send("DELETE", "/section/delete", { sectionid }),

  issues: (sectionid: number) =>
    get<{ issues: Issue[] }>("/issue/read", { sectionid }).then((r) => r.issues),
  createIssue: (sectionId: number, name: string, description: string, assignees: number[]) =>
    send("POST", "/issue/create", { name, description, sectionId, assignees }),
  updateIssue: (
    Issueid: number,
    patch: { name?: string; description?: string; assignees?: number[] },
  ) => send("PATCH", "/issue/update", { Issueid, ...patch }),
  moveIssue: (issueId: number, newSectionId: number) =>
    send("PATCH", "/issue/move", { issueId, newSectionId }),
  deleteIssue: (Issueid: number) => send("DELETE", "/issue/delete", { Issueid }),

  comments: (issueId: number) =>
    get<{ comments: Comment[] }>("/comment/read", { issueId }).then((r) => r.comments),
  createComment: (issueId: number, comment: string) =>
    send("POST", "/comment/create", { issueId, comment }),
  updateComment: (commentId: number, comment: string) =>
    send("PATCH", "/comment/update", { commentId, comment }),
  deleteComment: (commentId: number) => send("DELETE", "/comment/delete", { commentId }),

  members: (orgid: number) =>
    get<{ members: Member[] }>("/membership/read", { orgid }).then((r) => r.members),
  setRole: (orgId: number, userId: number, role: Role) =>
    send<{ message: string }>("PATCH", "/membership/updateRole", { orgId, userId, role }),
  kick: (orgId: number, userId: number) =>
    send("DELETE", "/membership/kick", { orgId, userId }),
  leaveOrg: (orgId: number) => send("DELETE", "/membership/delete", { orgId }),

  invite: (orgid: number, userEmail: string, role: Role) =>
    send("POST", "/invite/create", { orgid, userEmail, role }),
  invitesIn: () => get<{ invites: InviteIn[] }>("/invite/received").then((r) => r.invites),
  invitesOut: (orgid: number) =>
    get<{ invites: InviteOut[] }>("/invite/sent", { orgid }).then((r) => r.invites),
  acceptInvite: (inviteId: number) => send("POST", "/invite/accept", { inviteId }),
  deleteInvite: (inviteId: number) => send("DELETE", "/invite/delete", { inviteId }),
};

export const wsUrl = () =>
  BASE.replace(/^http/, "ws") + "/?token=" + encodeURIComponent(session.token ?? "");
