import type { RequestHandler } from "express";
import { pool } from "../../../migrations/db";
import {
  createIssue,
  deleteIssue,
  moveIssue,
  readIssue,
  updateIssue,
} from "./schema";

export const createController: RequestHandler = async (request, response) => {
  const checkInput = createIssue.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid name, description, section id, or assignees",
    });
  }

  const { name, description, sectionId, assignees } = checkInput.data;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userOrg = await client.query(
      `
      SELECT
        boards.orginisationId
      FROM sections
      JOIN boards
        ON boards.id = sections.boardId
      JOIN membership
        ON boards.orginisationId = membership.org_id
      WHERE membership.user_id = $1
        AND sections.id = $2
        AND membership.role = 'admin'
      `,
      [userId, sectionId],
    );

    if (!userOrg.rowCount) {
      await client.query("ROLLBACK");

      return response.status(403).json({
        error: "no permission",
      });
    }

    const orgId = userOrg.rows[0].orginisationid;

    if (assignees?.length) {
      const validAssignees = await client.query(
        `
        SELECT user_id
        FROM membership
        WHERE org_id = $1
          AND user_id = ANY($2::int[])
        `,
        [orgId, assignees],
      );

      if (validAssignees.rowCount !== assignees.length) {
        await client.query("ROLLBACK");

        return response.status(400).json({
          error: "one or more assignees are not members of the organization",
        });
      }
    }

    const issue = await client.query(
      `
      INSERT INTO issues (title, description, sectionId)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [name, description, sectionId],
    );

    const issueId = issue.rows[0].id;

    if (assignees?.length) {
      await client.query(
        `
        INSERT INTO issues_mapping (userid, issueid)
        SELECT unnest($1::int[]), $2
        `,
        [assignees, issueId],
      );
    }

    await client.query("COMMIT");

    return response.status(201).json({
      message: "issue created",
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
        boards.id = sections.boardId
      JOIN
        membership
      ON
        boards.orginisationId = membership.org_id
      WHERE
        membership.user_id = $1
        AND sections.id = $2
      `,
      [userid, sectionid],
    );

    if (!userOrg.rowCount) {
      return response.status(403).json({ error: "no permission" });
    }

    const issues = await pool.query(
      `
      SELECT
        issues.id,
        issues.title,
        issues.description,
        issues.sectionId,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', users.id,
              'email', users.email
            )
          ) FILTER (WHERE users.id IS NOT NULL),
          '[]'
        ) AS assignees
      FROM
        issues
      LEFT JOIN
        issues_mapping
      ON
        issues_mapping.issueid = issues.id
      LEFT JOIN
        users
      ON
        users.id = issues_mapping.userid
      WHERE
        issues.sectionId = $1
      GROUP BY
        issues.id
      `,
      [sectionid],
    );

    return response.status(200).json({
      issues: issues.rows,
    });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      error: "internal server error",
    });
  }
};

export const updateController: RequestHandler = async (request, response) => {
  const checkInput = updateIssue.safeParse(request.body);
  const userid = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid name, description, or assignees",
    });
  }

  const { Issueid, name, description, assignees } = checkInput.data;

  try {
    const userOrg = await pool.query(
      `
      SELECT
        membership.role,
        membership.org_id
      FROM
        issues
      JOIN
        sections
      ON
        issues.sectionId = sections.id
      JOIN
        boards
      ON
        boards.id = sections.boardId
      JOIN
        membership
      ON
        boards.orginisationId = membership.org_id
      WHERE
        membership.user_id = $1
        AND issues.id = $2
      `,
      [userid, Issueid],
    );

    if (!userOrg.rowCount || userOrg.rows[0].role !== "admin") {
      return response.status(403).json({
        error: "no permission",
      });
    }

    const orgId = userOrg.rows[0].org_id;

    if (assignees !== undefined) {
      const validAssignees = await pool.query(
        `
        SELECT
          user_id
        FROM
          membership
        WHERE
          org_id = $1
          AND user_id = ANY($2::int[])
        `,
        [orgId, assignees],
      );

      if (validAssignees.rowCount !== assignees.length) {
        return response.status(400).json({
          error: "one or more assignees are not members of the organization",
        });
      }
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        UPDATE issues
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description)
        WHERE
          id = $3
        `,
        [name, description, Issueid],
      );

      if (assignees !== undefined) {
        await client.query(
          `
          DELETE FROM issues_mapping
          WHERE issueid = $1
          `,
          [Issueid],
        );

        if (assignees.length > 0) {
          await client.query(
            `
            INSERT INTO issues_mapping (userid, issueid)
            SELECT
              user_id,
              $1
            FROM
              membership
            WHERE
              org_id = $2
              AND user_id = ANY($3::int[])
            `,
            [Issueid, orgId, assignees],
          );
        }
      }

      await client.query("COMMIT");

      return response.status(200).json({
        message: "issue updated",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.log(error);

    return response.status(500).json({
      error: "internal server error",
    });
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
