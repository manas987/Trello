import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { pool } from "../../migrations/db";
import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";

async function auth(token: string | null | undefined): Promise<number | null> {
  if (!token) {
    return null;
  }

  try {
    const verify = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number;
    };

    const user = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
      `,
      [verify.userId],
    );

    if (!user.rowCount) {
      return null;
    }

    return verify.userId;
  } catch {
    return null;
  }
}

export async function authWs(
  ws: WebSocket,
  request: IncomingMessage,
): Promise<number> {
  const token = new URLSearchParams(request.url?.split("?")[1]).get("token");
  const userId = await auth(token);

  if (!userId) {
    ws.close(1008, "Unauthorized");
    throw new Error("Unauthorized");
  }

  return userId;
}

export const authMiddleware: RequestHandler = async (
  request,
  response,
  nextfunction,
) => {
  const userId = await auth(request.headers.authorization);

  if (!userId) {
    return response.status(401).json({
      error: "Invalid token",
    });
  }

  response.locals.userid = userId;

  nextfunction();
};
