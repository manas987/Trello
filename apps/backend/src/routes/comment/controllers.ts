import type { RequestHandler } from "express";
import { pool } from "../../../migrations/db";
import {
  createComment,
  deleteComment,
  readComment,
  updateComment,
} from "./schema";

export const createController: RequestHandler = async (request, response) => {
  const checkInput = createComment.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid issue id or comment",
    });
  }

  const { issueId, comment } = checkInput.data;

  try {
    const userIssue = await pool.query(
      `
      SELECT 1
      FROM issues
      JOIN sections
        ON issues.sectionId = sections.id
      JOIN boards
        ON boards.id = sections.boardId
      JOIN membership
        ON boards.orginisationId = membership.org_id
      WHERE membership.user_id = $1
        AND issues.id = $2
      `,
      [userId, issueId],
    );

    if (!userIssue.rowCount) {
      return response.status(403).json({
        error: "no permission",
      });
    }

    await pool.query(
      `
      INSERT INTO comments (issueId, comment, userId)
      VALUES ($1, $2, $3)
      `,
      [issueId, comment, userId],
    );

    return response.status(201).json({
      message: "comment created",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};

export const readController: RequestHandler = async (request, response) => {
  const checkInput = readComment.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid issue id",
    });
  }

  const { issueId } = checkInput.data;

  try {
    const userIssue = await pool.query(
      `
      SELECT 1
      FROM issues
      JOIN sections
        ON issues.sectionId = sections.id
      JOIN boards
        ON boards.id = sections.boardId
      JOIN membership
        ON boards.orginisationId = membership.org_id
      WHERE membership.user_id = $1
        AND issues.id = $2
      `,
      [userId, issueId],
    );

    if (!userIssue.rowCount) {
      return response.status(403).json({
        error: "no permission",
      });
    }

    const comments = await pool.query(
      `
      SELECT
        comments.id,
        comments.comment,
        comments.userId
      FROM comments
      WHERE comments.issueId = $1
      ORDER BY comments.id ASC
      `,
      [issueId],
    );

    return response.status(200).json({
      comments: comments.rows,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};

export const updateController: RequestHandler = async (request, response) => {
  const checkInput = updateComment.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid comment id or comment",
    });
  }

  const { commentId, comment } = checkInput.data;

  try {
    const permission = await pool.query(
      `
      SELECT
        comments.userId AS comment_user_id,
        membership.role
      FROM comments
      JOIN issues
        ON issues.id = comments.issueId
      JOIN sections
        ON sections.id = issues.sectionId
      JOIN boards
        ON sections.boardId = boards.id
      JOIN membership
        ON boards.orginisationId = membership.org_id
       AND membership.user_id = $1
      WHERE comments.id = $2
      `,
      [userId, commentId],
    );

    if (!permission.rowCount) {
      return response.status(404).json({
        error: "comment not found",
      });
    }

    const row = permission.rows[0];

    if (row.comment_user_id !== userId && row.role !== "admin") {
      return response.status(403).json({
        error: "no permission",
      });
    }

    await pool.query(
      `
      UPDATE comments
      SET comment = $1
      WHERE id = $2
      `,
      [comment, commentId],
    );

    return response.status(200).json({
      message: "comment updated",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};

export const deleteController: RequestHandler = async (request, response) => {
  const checkInput = deleteComment.safeParse(request.body);
  const userId = response.locals.userid;

  if (!checkInput.success) {
    return response.status(400).json({
      error: "invalid comment id",
    });
  }

  const { commentId } = checkInput.data;

  try {
    const permission = await pool.query(
      `
      SELECT
        comments.userId AS comment_user_id,
        membership.role
      FROM comments
      JOIN issues
        ON issues.id = comments.issueId
      JOIN sections
        ON sections.id = issues.sectionId
      JOIN boards
        ON sections.boardId = boards.id
      JOIN membership
        ON boards.orginisationId = membership.org_id
       AND membership.user_id = $1
      WHERE comments.id = $2
      `,
      [userId, commentId],
    );

    if (!permission.rowCount) {
      return response.status(404).json({
        error: "comment not found",
      });
    }

    const row = permission.rows[0];

    if (row.comment_user_id !== userId && row.role !== "admin") {
      return response.status(403).json({
        error: "no permission",
      });
    }

    await pool.query(
      `
      DELETE FROM comments
      WHERE id = $1
      `,
      [commentId],
    );

    return response.status(200).json({
      message: "comment deleted",
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "internal server error",
    });
  }
};