import type { RequestHandler } from "express";
import { pool } from "../../../migrations/db";
import {
  createInvite,
  readSentInvite,
  acceptInvite,
  deleteInvite,
} from "./schema";

export const createController: RequestHandler = async (request, response) => {
  const checkInput = createInvite.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid organization id or email",
    });
  }

  const { orgid, userEmail } = checkInput.data;

  try {
    const admin = await pool.query(
      `
      SELECT 1
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
        AND role = 'admin'
      `,
      [userId, orgid],
    );

    if (!admin.rowCount) {
      return response.status(403).json({
        error: "no permission",
      });
    }

    const invitedUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      `,
      [userEmail],
    );

    if (!invitedUser.rowCount) {
      return response.status(404).json({
        error: "user not found",
      });
    }

    const invitedUserId = invitedUser.rows[0].id;

    const existingMembership = await pool.query(
      `
      SELECT 1
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
      `,
      [invitedUserId, orgid],
    );

    if (existingMembership.rowCount) {
      return response.status(400).json({
        error: "user is already a member",
      });
    }

    await pool.query(
      `
      INSERT INTO invites (org_id, user_id)
      VALUES ($1, $2)
      `,
      [orgid, invitedUserId],
    );

    return response.status(201).json({
      message: "invite created",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};

export const readReceivedController: RequestHandler = async (
  request,
  response,
) => {
  const userId = response.locals.userid;

  try {
    const invites = await pool.query(
      `
      SELECT
        invites.id,
        orgs.id AS org_id,
        orgs.name,
        orgs.description
      FROM invites
      JOIN orgs
        ON invites.org_id = orgs.id
      WHERE invites.user_id = $1
      `,
      [userId],
    );

    return response.status(200).json({
      invites: invites.rows,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};

export const readSentController: RequestHandler = async (request, response) => {
  const checkInput = readSentInvite.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid organization id",
    });
  }

  const { orgid } = checkInput.data;

  try {
    // Only an admin can see the organization's sent invites.
    const admin = await pool.query(
      `
      SELECT 1
      FROM membership
      WHERE user_id = $1
        AND org_id = $2
        AND role = 'admin'
      `,
      [userId, orgid],
    );

    if (!admin.rowCount) {
      return response.status(403).json({
        error: "no permission",
      });
    }

    const invites = await pool.query(
      `
      SELECT
        invites.id,
        users.id AS user_id,
        users.email
      FROM invites
      JOIN users
        ON invites.user_id = users.id
      WHERE invites.org_id = $1
      `,
      [orgid],
    );

    return response.status(200).json({
      invites: invites.rows,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};

export const acceptController: RequestHandler = async (request, response) => {
  const checkInput = acceptInvite.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid invite id",
    });
  }

  const { inviteId } = checkInput.data;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const invite = await client.query(
      `
      SELECT org_id
      FROM invites
      WHERE id = $1
        AND user_id = $2
      `,
      [inviteId, userId],
    );

    if (!invite.rowCount) {
      await client.query("ROLLBACK");

      return response.status(404).json({
        error: "invite not found",
      });
    }

    const orgId = invite.rows[0].org_id;

    await client.query(
      `
      INSERT INTO membership (user_id, org_id, role)
      VALUES ($1, $2, 'member')
      `,
      [userId, orgId],
    );

    await client.query(
      `
      DELETE FROM invites
      WHERE id = $1
      `,
      [inviteId],
    );

    await client.query("COMMIT");

    return response.status(200).json({
      message: "invite accepted",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  } finally {
    client.release();
  }
};

export const deleteController: RequestHandler = async (request, response) => {
  const checkInput = deleteInvite.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid invite id",
    });
  }

  const { inviteId } = checkInput.data;

  try {
    const invite = await pool.query(
      `
  SELECT
    1
  FROM invites
  LEFT JOIN membership
    ON membership.org_id = invites.org_id
   AND membership.user_id = $1
   AND membership.role = 'admin'
  WHERE
    invites.id = $2
    AND (
      membership.user_id IS NOT NULL
      OR invites.user_id = $1
    )
  `,
      [userId, inviteId],
    );

    if (!invite.rowCount) {
      return response.status(404).json({
        error: "invite not found or no permission",
      });
    }

    await pool.query(
      `
      DELETE FROM invites
      WHERE id = $1
      `,
      [inviteId],
    );

    return response.status(200).json({
      message: "invite deleted",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};
