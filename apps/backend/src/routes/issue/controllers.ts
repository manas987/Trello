import type { RequestHandler } from "express";
import { pool } from "../../../migrations/db";
import {
  createIssue,
  deleteIssue,
  moveIssue,
  readIssue,
  updateIssue,
} from "./schema";
import { sectionRouter } from "../section/routes";

export const createController: RequestHandler = async (request, response) => {
  const checkInput = createIssue.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { name, description, sectionId } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        role
      FROM
        sections
      JOIN
        boards
      ON 
        boards.id=sections.boardId
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
        membership.user_id=$1 and sections.id=$2
      `,
      [userid, sectionId],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(403).json({ error: "no permission" });

    await pool.query(
      `
      INSERT INTO issues (title,description,sectionId)
      VALUES ($1,$2,$3)
      `,
      [name, description, sectionId],
    );

    return response.status(201).json({ message: "issue created" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const readController: RequestHandler = async (request, response) => {
  const checkInput = readIssue.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { sectionid } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        1
      FROM
        sections
      JOIN
        boards
      ON 
        boards.id=sections.boardId
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
        membership.user_id=$1 and sections.id=$2
      `,
      [userid, sectionid],
    );

    if (!userOrg.rowCount)
      return response.status(403).json({ error: "no permission" });

    const issues = await pool.query(
      `
      SELECT
        *
      FROM
        issues
      WHERE
        sectionId = $1
      `,
      [sectionid],
    );

    return response.status(200).json({
      issues: issues.rows,
    });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const updateController: RequestHandler = async (request, response) => {
  const checkInput = updateIssue.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { Issueid, name, description } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        role
      FROM
        issues
      JOIN
        sections
      ON
        issues.sectionId=sections.id
      JOIN
        boards
      ON 
        boards.id=sections.boardId
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
        membership.user_id=$1 and issues.id=$2
      `,
      [userid, Issueid],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(403).json({ error: "no permission" });

    await pool.query(
      `
      UPDATE issues
      SET
        title=COALESCE($1,title),
        description=COALESCE($2,description)
      WHERE 
        id=$3
      `,
      [name, description, Issueid],
    );

    return response.status(200).json({ message: "issue Updated" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const moveController: RequestHandler = async (request, response) => {
  const checkInput = moveIssue.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { newSectionId, issueId } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        role
      FROM
        issues
      JOIN
        sections
      ON
        issues.sectionId=sections.id
      JOIN
        boards
      ON 
        boards.id=sections.boardId
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
        membership.user_id=$1 and issues.id=$2
      `,
      [userid, issueId],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(403).json({ error: "no permission" });

    const issueSections = await pool.query(
      `
      SELECT
        current_section.boardId AS current_board,
        new_section.boardId AS new_board,
        issues.sectionId AS current_section
      FROM 
        issues
      JOIN 
        sections AS current_section
      ON 
        issues.sectionId = current_section.id
      JOIN 
        sections AS new_section
      ON 
        new_section.id = $1
      WHERE 
        issues.id = $2
  `,
      [newSectionId, issueId],
    );

    const row = issueSections.rows[0];

    if (!row) {
      return response.status(404).json({
        error: "issue or section not found",
      });
    }

    if (row.current_board !== row.new_board) {
      return response.status(403).json({
        error: "cannot move issue to another board",
      });
    }

    if (row.current_section === newSectionId) {
      return response.status(400).json({
        error: "issue is already in this section",
      });
    }
    await pool.query(
      `
      UPDATE 
        issues
      SET 
        sectionId = $1
      WHERE 
        id = $2
      `,
      [newSectionId, issueId],
    );

    return response.status(200).json({ message: "issue Moved" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};

export const deleteController: RequestHandler = async (request, response) => {
  const checkInput = deleteIssue.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({ error: "invalid name or description" });
  }

  const { Issueid } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        role
      FROM
        issues
      JOIN
        sections
      ON
        issues.sectionId=sections.id
      JOIN
        boards
      ON 
        boards.id=sections.boardId
      JOIN
        membership
      ON
        boards.orginisationId=membership.org_id
      WHERE
        membership.user_id=$1 and issues.id=$2
      `,
      [userid, Issueid],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role != "admin")
      return response.status(403).json({ error: "no permission" });

    await pool.query(
      `
      DELETE FROM
       issues
      WHERE
       id=$1
      `,
      [Issueid],
    );

    return response.status(200).json({ message: "issue deleted" });
  } catch (error) {
    console.log(error);
    return response.status(500).json({ error: "internal server error" });
  }
};
