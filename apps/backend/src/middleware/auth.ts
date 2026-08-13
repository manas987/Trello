import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { pool } from "../../migrations/db";

export const authMiddleware: RequestHandler = async (
  request,
  response,
  nextfunction,
) => {
  const token = request.headers.authorization;

  if (!token) {
    return response.status(401).json({ error: "Token not found" });
  }

  try {
    const verify = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number;
    };

    try {
      const userexists = await pool.query("SELECT id FROM users WHERE id=$1", [
        verify.userId,
      ]);

      if (!userexists.rowCount)
        return response.status(401).json({ error: "user no longer exists" });
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: "internal server error" });
    }

    response.locals.userid = verify.userId;

    nextfunction();
  } catch {
    return response.status(401).json({ error: "Invalid Token" });
  }
};
