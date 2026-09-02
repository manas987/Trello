import type { RequestHandler } from "express";
import { createBoard, deleteBoard, readBoard, updateBoard } from "./schema";
import { pool } from "../../../migrations/db";
import { broadcastToOrg } from "../../websocket/rooms/roomManager";

export const createController: RequestHandler = async (request, response) => {
  const checkInput = createBoard.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { name, organizationId } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        role
      FROM 
        membership
      WHERE
        user_id=$1 and org_id=$2
      `,
      [userid, organizationId],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(400).json({ error: "no permission" });

    await pool.query(
      `
      INSERT INTO boards (title,orginisationId)
      VALUES ($1,$2)
      `,
      [name, organizationId],
    );
    broadcastToOrg(
      organizationId,
      JSON.stringify({ event: "board:updated", organizationId }),
    );

    return response.status(201).json({
      message: "board created",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  }
};

export const readController: RequestHandler = async (request, response) => {
  const checkInput = readBoard.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { orgid } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        role
      FROM 
        membership
      WHERE
        user_id=$1 and org_id=$2
      `,
      [userid, orgid],
    );

    if (!userOrg.rowCount)
      return response.status(400).json({ error: "no permission" });

    const boards = await pool.query(
      `
      SELECT
        *
      FROM
        boards
      WHERE
        orginisationId=$1
      `,
      [orgid],
    );

    return response.status(200).json({ orgs: boards.rows });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const updateController: RequestHandler = async (request, response) => {
  const checkInput = updateBoard.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { boardid, name } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
       membership.role , orgs.id
      FROM 
        boards
      JOIN
        orgs
      ON
        boards.orginisationId=orgs.id
      JOIN
        membership
      ON
        orgs.id=membership.org_id
      WHERE
          membership.user_id = $1 and boards.id = $2
      `,
      [userid, boardid],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(400).json({ error: "no permission" });

    await pool.query(
      `
      UPDATE boards
      SET
        title=$1
      WHERE
        id=$2
      `,
      [name, boardid],
    );

    broadcastToOrg(
      userOrg.rows[0].id,
      JSON.stringify({
        event: "board:updated",
        organizationId: userOrg.rows[0].id,
      }),
    );

    return response.status(200).json({ message: "board updated" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const deleteController: RequestHandler = async (request, response) => {
  const checkInput = deleteBoard.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { boardid } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
       membership.role , orgs.id
      FROM 
        boards
      JOIN
        orgs
      ON
        boards.orginisationId=orgs.id
      JOIN
        membership
      ON
        orgs.id=membership.org_id
      WHERE
          membership.user_id = $1 and boards.id = $2
      `,
      [userid, boardid],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(400).json({ error: "no permission" });

    await pool.query(
      `
      DELETE
      FROM
        boards
      WHERE
        id=$1
      `,
      [boardid],
    );

    broadcastToOrg(
      userOrg.rows[0].id,
      JSON.stringify({
        event: "board:updated",
        organizationId: userOrg.rows[0].id,
      }),
    );

    return response.status(200).json({ message: "board deleted" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};
