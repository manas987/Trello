import type { WebSocket } from "ws";
import { pool } from "../../../migrations/db";

// Organization → sockets currently active inside that organization
const orgs = new Map<number, Set<WebSocket>>();

// Organization → admin sockets currently active inside that organization
const orgAdmins = new Map<number, Set<WebSocket>>();

// Board → sockets currently active inside that board
const boards = new Map<number, Set<WebSocket>>();

// User → all sockets belonging to that user
const users = new Map<number, Set<WebSocket>>();

const socketState = new Map<
  WebSocket,
  {
    userId: number;
    orgs: number | null;
    adminOrgs: number | null;
    boards: number | null;
  }
>();

export function joinOrgAdmins(orgId: number, ws: WebSocket) {
  const temp = socketState.get(ws);

  if (temp) temp.adminOrgs = orgId;

  if (!orgAdmins.has(orgId)) {
    orgAdmins.set(orgId, new Set());
  }

  orgAdmins.get(orgId)?.add(ws);
}

export function leaveOrgAdmins(ws: WebSocket) {
  const temp = socketState.get(ws);

  if (temp?.adminOrgs !== null && temp?.adminOrgs !== undefined) {
    const sockets = orgAdmins.get(temp.adminOrgs);

    sockets?.delete(ws);

    if (sockets?.size === 0) {
      orgAdmins.delete(temp.adminOrgs);
    }
  }

  if (temp) temp.adminOrgs = null;
}

export async function joinOrg(
  orgId: number,
  ws: WebSocket,
  userId: number,
) {
  const role = await pool.query(
    `
    SELECT role
    FROM membership
    WHERE user_id = $1 AND org_id = $2
    `,
    [userId, orgId],
  );

  if (role.rowCount === 0) return;

  leaveOrg(ws);

  const temp = socketState.get(ws);

  if (temp) temp.orgs = orgId;

  if (!orgs.has(orgId)) {
    orgs.set(orgId, new Set());
  }

  orgs.get(orgId)?.add(ws);

  if (role.rows[0].role === "admin") {
    joinOrgAdmins(orgId, ws);
  }
}

export function leaveOrg(ws: WebSocket) {
  const temp = socketState.get(ws);

  if (temp?.orgs !== null && temp?.orgs !== undefined) {
    const sockets = orgs.get(temp.orgs);

    sockets?.delete(ws);

    if (sockets?.size === 0) {
      orgs.delete(temp.orgs);
    }
  }

  if (temp) temp.orgs = null;

  if (temp?.adminOrgs !== null && temp?.adminOrgs !== undefined) {
    leaveOrgAdmins(ws);
  }
}

export function joinBoard(boardId: number, ws: WebSocket) {
  leaveBoard(ws);

  const temp = socketState.get(ws);

  if (temp) temp.boards = boardId;

  if (!boards.has(boardId)) {
    boards.set(boardId, new Set());
  }

  boards.get(boardId)?.add(ws);
}

export function leaveBoard(ws: WebSocket) {
  const temp = socketState.get(ws);

  if (temp?.boards !== null && temp?.boards !== undefined) {
    const sockets = boards.get(temp.boards);

    sockets?.delete(ws);

    if (sockets?.size === 0) {
      boards.delete(temp.boards);
    }
  }

  if (temp) temp.boards = null;
}

export function broadcastToOrg(orgId: number, message: string) {
  const temp = orgs.get(orgId);

  if (!temp) return;

  for (const ws of temp) {
    ws.send(message);
  }
}

export function broadcastToOrgAdmins(orgId: number, message: string) {
  const temp = orgAdmins.get(orgId);

  if (!temp) return;

  for (const ws of temp) {
    ws.send(message);
  }
}

export function broadcastToBoard(boardId: number, message: string) {
  const temp = boards.get(boardId);

  if (!temp) return;

  for (const ws of temp) {
    ws.send(message);
  }
}

export function addUserSocket(userId: number, ws: WebSocket) {
  if (!users.has(userId)) {
    users.set(userId, new Set());
  }

  users.get(userId)?.add(ws);

  socketState.set(ws, {
    userId,
    orgs: null,
    adminOrgs: null,
    boards: null,
  });
}

export function removeUserSocket(userId: number) {
  const temp = users.get(userId);

  if (!temp) return;

  for (const ws of [...temp]) {
    removeSocket(ws);
  }
}

export function sendToUser(userId: number, message: string) {
  const temp = users.get(userId);

  if (!temp) return;

  for (const ws of temp) {
    ws.send(message);
  }
}

export function removeSocket(ws: WebSocket) {
  const temp = socketState.get(ws);

  if (!temp) return;

  if (temp.boards !== null) {
    const sockets = boards.get(temp.boards);

    sockets?.delete(ws);

    if (sockets?.size === 0) {
      boards.delete(temp.boards);
    }
  }

  if (temp.adminOrgs !== null) {
    const sockets = orgAdmins.get(temp.adminOrgs);

    sockets?.delete(ws);

    if (sockets?.size === 0) {
      orgAdmins.delete(temp.adminOrgs);
    }
  }

  if (temp.orgs !== null) {
    const sockets = orgs.get(temp.orgs);

    sockets?.delete(ws);

    if (sockets?.size === 0) {
      orgs.delete(temp.orgs);
    }
  }

  if (users.has(temp.userId)) {
    const sockets = users.get(temp.userId);

    sockets?.delete(ws);

    if (sockets?.size === 0) {
      users.delete(temp.userId);
    }
  }

  socketState.delete(ws);
}