import type { RequestHandler } from "express";
import { leaveMembership } from "./schema";
import { pool } from "../../../migrations/db";
import { broadcastToOrgAdmins } from "../../websocket/rooms/roomManager";

export const readController: RequestHandler = async (request, response) => {
  const userid = response.locals.userid;

  try {
    const memberships = await pool.query(
      `
        SELECT
          orgs.id,
          orgs.name,
          orgs.description
        FROM
          membership
        JOIN
          orgs
        ON
          membership.org_id=orgs.id
        WHERE
          user_id=$1
        `,
      [userid],
    );

    return response.status(200).json({ memberships: memberships.rows });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      error: "server error",
    });
  }
};

export const kickController: RequestHandler = async (request, response) => {
  const checkInput = leaveMembership.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { orgId } = checkInput.data;

  try {
    await pool.query(
      `
        DELETE
        FROM
         membership
        WHERE
        user_id=$1 and org_id=$2
        `,
      [userid, orgId],
    );

    broadcastToOrgAdmins(
      orgId,
      JSON.stringify({ event: "membership:updated" }),
    );

    return response.status(200).json({ message: "left the org" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      error: "server error",
    });
  }
};

export const leaveController: RequestHandler = async (request, response) => {
  const checkInput = leaveMembership.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { orgId } = checkInput.data;

  try {
    await pool.query(
      `
        DELETE
        FROM
         membership
        WHERE
        user_id=$1 and org_id=$2
        `,
      [userid, orgId],
    );

    broadcastToOrgAdmins(
      orgId,
      JSON.stringify({ event: "membership:updated" }),
    );

    return response.status(200).json({ message: "left the org" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      error: "server error",
    });
  }
};
