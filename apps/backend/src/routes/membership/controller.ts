import type { RequestHandler } from "express";
import {
  changeMembership,
  kickMembership,
  leaveMembership,
  readMembership,
} from "./schema";
import { pool } from "../../../migrations/db";
import {
  broadcastToOrgAdmins,
  sendToUser,
} from "../../websocket/rooms/roomManager";

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

export const changeRoleController: RequestHandler = async (
  request,
  response,
) => {
  const checkInput = changeMembership.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid organization, user, or role",
    });
  }

  const { orgId, userId: targetUserId, role } = checkInput.data;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock all memberships for this organization.
    // This prevents concurrent membership changes from
    // removing the final admin.
    await client.query(
      `
      SELECT user_id
      FROM membership
      WHERE org_id = $1
      FOR UPDATE
      `,
      [orgId],
    );

    const admin = await client.query(
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
      await client.query("ROLLBACK");

      return response.status(403).json({
        error: "no permission",
      });
    }

    const target = await client.query(
      `
      SELECT role
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [targetUserId, orgId],
    );

    if (!target.rowCount) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        error: "user is not a member of this organization",
      });
    }

    const currentRole = target.rows[0].role;

    // No point updating if the role is already the requested role.
    if (currentRole === role) {
      await client.query("COMMIT");

      return response.status(200).json({
        message: "user role unchanged",
      });
    }

    // Prevent the organization from having zero admins.
    if (currentRole === "admin" && role === "member") {
      const adminCount = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM membership
        WHERE org_id = $1
          AND role = 'admin'
        `,
        [orgId],
      );

      if (adminCount.rows[0].count <= 1) {
        await client.query("ROLLBACK");

        return response.status(400).json({
          error: "organization must have at least one admin",
        });
      }
    }

    await client.query(
      `
      UPDATE membership
      SET role = $1
      WHERE user_id = $2
        AND org_id = $3
      `,
      [role, targetUserId, orgId],
    );

    await client.query("COMMIT");

    broadcastToOrgAdmins(
      orgId,
      JSON.stringify({
        event: "membership:updated",
      }),
    );

    sendToUser(
      targetUserId,
      JSON.stringify({
        event: "membership:role_changed",
        orgId,
        role,
      }),
    );

    return response.status(200).json({
      message: "user role updated",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  } finally {
    client.release();
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock all memberships in this organization.
    await client.query(
      `
      SELECT user_id
      FROM membership
      WHERE org_id = $1
      FOR UPDATE
      `,
      [orgId],
    );

    const admin = await client.query(
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
      await client.query("ROLLBACK");

      return response.status(403).json({
        error: "no permission",
      });
    }

    const target = await client.query(
      `
      SELECT role
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [targetUserId, orgId],
    );

    if (!target.rowCount) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        error: "user is not a member of this organization",
      });
    }

    // If the target is an admin, make sure they aren't the
    // organization's final admin.
    if (target.rows[0].role === "admin") {
      const adminCount = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM membership
        WHERE org_id = $1
          AND role = 'admin'
        `,
        [orgId],
      );

      if (adminCount.rows[0].count <= 1) {
        await client.query("ROLLBACK");

        return response.status(400).json({
          error: "organization must have at least one admin",
        });
      }
    }

    await client.query(
      `
      DELETE FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [targetUserId, orgId],
    );

    await client.query("COMMIT");

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
    await client.query("ROLLBACK");

    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  } finally {
    client.release();
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock all memberships in this organization.
    await client.query(
      `
      SELECT user_id
      FROM membership
      WHERE org_id = $1
      FOR UPDATE
      `,
      [orgId],
    );

    const membership = await client.query(
      `
      SELECT role
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [userId, orgId],
    );

    if (!membership.rowCount) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        error: "you are not a member of this organization",
      });
    }

    // Prevent the final admin from leaving.
    if (membership.rows[0].role === "admin") {
      const adminCount = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM membership
        WHERE org_id = $1
          AND role = 'admin'
        `,
        [orgId],
      );

      if (adminCount.rows[0].count <= 1) {
        await client.query("ROLLBACK");

        return response.status(400).json({
          error: "organization must have at least one admin",
        });
      }
    }

    await client.query(
      `
      DELETE FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [userId, orgId],
    );

    await client.query("COMMIT");

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
    await client.query("ROLLBACK");

    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  } finally {
    client.release();
  }
};