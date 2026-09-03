import type { RequestHandler } from "express";
import { createOrg, deleteOrg, updateOrg } from "./schema";
import { pool } from "../../../migrations/db";
import { broadcastToOrg } from "../../websocket/rooms/roomManager";

export const createController: RequestHandler = async (request, response) => {
  const checkInput = createOrg.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { name, description } = checkInput.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const org = await client.query(
      `INSERT INTO orgs (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      [name, description],
    );

    const orgid = org.rows[0].id;

    await client.query(
      `INSERT INTO membership (user_id, org_id, role)
       VALUES ($1, $2, 'admin')`,
      [userid, orgid],
    );

    await client.query("COMMIT");

    return response.status(201).json({
      message: "organization created",
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

export const readController: RequestHandler = async (request, response) => {
  const userId = response.locals.userid;

  try {
    const orgs = await pool.query(
      `
      SELECT
        orgs.id,
        orgs.name,
        orgs.description,
        membership.role
      FROM
        membership
      JOIN
        orgs
      ON
        orgs.id=membership.org_id
      WHERE 
        membership.user_id=$1`,
      [userId],
    );

    return response.status(200).json({ orgs: orgs.rows });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const updateController: RequestHandler = async (request, response) => {
  const checkInput = updateOrg.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success)
    return response
      .status(400)
      .json({ error: "need atlest one of name or description" });

  const { orgid, name, description } = checkInput.data;

  try {
    const userRole = await pool.query(
      `
      SELECT 
        role
      FROM
        membership
      WHERE
        user_id=$1 and org_id=$2
      `,
      [userId, orgid],
    );

    if (!userRole.rowCount || userRole.rows[0].role != "admin") {
      return response.status(403).json({ error: "no permissions" });
    }

    await pool.query(
      `
      UPDATE 
        orgs
      SET 
        name=COALESCE($1,name), description=COALESCE($2,description)
      WHERE
        id=$3
      `,
      [name, description, orgid],
    );
    
    broadcastToOrg(
      orgid,
      JSON.stringify({
        event: "org:changed",
      }),
    );

    return response.status(200).json({ message: "org updated" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const deleteController: RequestHandler = async (request, response) => {
  const checkInput = deleteOrg.safeParse(request.body);
  const userId = response.locals.userId;

  if (!checkInput.success)
    return response.status(400).json({ error: "invalid org id" });

  const { orgid } = checkInput.data;

  try {
    const userRole = await pool.query(
      `
      SELECT
        role
      FROM
        membership
      WHERE
        user_id=$1 and org_id=$2
      `,
      [userId, orgid],
    );

    if (!userRole.rowCount || userRole.rows[0].role != "admin") {
      return response.status(403).json({ error: "no permissions" });
    }

    await pool.query(
      `
      DELETE FROM orgs
      WHERE id=$1
      `,
      [orgid],
    );

    broadcastToOrg(
      orgid,
      JSON.stringify({
        event: "org:updated",
        orgId: orgid,
      }),
    );

    return response.status(200).json({
      message: "organization deleted",
    });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};
