import type { RequestHandler } from "express";
import { kickMembership, leaveMembership, readMembership } from "./schema";
import { pool } from "../../../migrations/db";
import { broadcastToOrgAdmins, sendToUser } from "../../websocket/rooms/roomManager";

export const readController: RequestHandler = async (request, response) => {
  const checkInput = readMembership.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid organization id",
    });
  }

  const { orgid } = checkInput.data;

  try {
    const membership = await pool.query(
      `
      SELECT 1
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [userId, orgid],
    );

    if (!membership.rowCount) {
      return response.status(403).json({
        error: "no permission",
      });
    }

    const members = await pool.query(
      `
      SELECT
        users.id,
        users.email,
        membership.role
      FROM membership
      JOIN users
        ON users.id = membership.user_id
      WHERE membership.org_id = $1
      ORDER BY users.id
      `,
      [orgid],
    );

    return response.status(200).json({
      members: members.rows,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  }
};

export const kickController: RequestHandler = async (request, response) => {
  const checkInput = kickMembership.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid organization or user id",
    });
  }

  const { orgId, userId: targetUserId } = checkInput.data;

  try {
    const admin = await pool.query(
      `
      SELECT 1
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
        AND role = 'admin'
      `,
      [userId, orgId],
    );

    if (!admin.rowCount) {
      return response.status(403).json({
        error: "no permission",
      });
    }

    const kicked = await pool.query(
      `
      DELETE FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [targetUserId, orgId],
    );

    if (!kicked.rowCount) {
      return response.status(404).json({
        error: "user is not a member of this organization",
      });
    }

    broadcastToOrgAdmins(
      orgId,
      JSON.stringify({
        event: "membership:updated",
      }),
    );

    sendToUser(
      targetUserId,
      JSON.stringify({
        event: "membership:removed",
        orgId,
      }),
    );

    return response.status(200).json({
      message: "user kicked from organization",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  }
};

export const leaveController: RequestHandler = async (
  request,
  response,
) => {
  const checkInput = leaveMembership.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid organization id",
    });
  }

  const { orgId } = checkInput.data;

  try {
    const result = await pool.query(
      `
      DELETE FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [userId, orgId],
    );

    if (!result.rowCount) {
      return response.status(404).json({
        error: "you are not a member of this organization",
      });
    }

    broadcastToOrgAdmins(
      orgId,
      JSON.stringify({
        event: "membership:updated",
      }),
    );

    sendToUser(
      userId,
      JSON.stringify({
        event: "membership:removed",
        orgId,
      }),
    );

    return response.status(200).json({
      message: "left the org",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  }
};
