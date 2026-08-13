import type { RequestHandler } from "express";
import {
  createSection,
  deleteSection,
  readSection,
  updateSection,
} from "./schema";
import { pool } from "../../../migrations/db";

export const createController: RequestHandler = async (request, response) => {
  const checkInput = createSection.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { name, boardId } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
       membership.role
      FROM 
        boards
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
          membership.user_id = $1 and boards.id = $2
      `,
      [userid, boardId],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(400).json({ error: "no permission" });

    await pool.query(
      `
      INSERT INTO sections (title,boardId)
      VALUES ($1,$2)
      `,
      [name, boardId],
    );

    return response.status(201).json({
      message: "section created",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  }
};

export const readController: RequestHandler = async (request, response) => {
  const checkInput = readSection.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { boardid } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        1
      FROM 
        boards
      JOIN
        membership
      ON
        membership.org_id=boards.orginisationId
      WHERE
        membership.user_id=$1 and boards.id=$2
      `,
      [userid, boardid],
    );

    if (!userOrg.rowCount)
      return response.status(400).json({ error: "no permission" });

    const sections = await pool.query(
      `
      SELECT
        *
      FROM
        sections
      WHERE
        boardId=$1
      `,
      [boardid],
    );

    return response.status(200).json({ sections: sections.rows });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const updateController: RequestHandler = async (request, response) => {
  const checkInput = updateSection.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { sectionid, name } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
       membership.role
      FROM 
        sections
      JOIN
        boards
      ON
        boards.id=sections.boardid
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
          membership.user_id = $1 and sections.id = $2
      `,
      [userid, sectionid],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(400).json({ error: "no permission" });

    await pool.query(
      `
      UPDATE sections
      SET
        title=$1
      WHERE
        id=$2
      `,
      [name, sectionid],
    );

    return response.status(200).json({ message: "section updated" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const deleteController: RequestHandler = async (request, response) => {
  const checkInput = deleteSection.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { sectionid } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
       membership.role
      FROM 
        sections
      JOIN
        boards
      ON
        boards.id=sections.boardid
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
          membership.user_id = $1 and sections.id = $2
      `,
      [userid, sectionid],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(400).json({ error: "no permission" });

    await pool.query(
      `
      DELETE
      FROM
        sections
      WHERE
        id=$1
      `,
      [sectionid],
    );

    return response.status(200).json({ message: "section deleted" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};
