import type { RequestHandler } from "express";
import { createOrg } from "./schema";
import { pool } from "../../../migrations/db";

export const createController: RequestHandler = async (request, response) => {
  try {
    const checkInput = createOrg.safeParse(request.body);
    const userid = response.locals.userid;

    if (!checkInput.success) {
      return response
        .status(400)
        .json({ error: "invalid name or description" });
    }

    const { name, description } = checkInput.data;

    const idk = pool.query(
      `INSERT INTO orgs (name,description) 
      VALUS ($1,$2) 
      RETURNING id`,
      [name, description],
    );
    console.log(idk);
  } catch (error) {
    console.log(error);

    return response.status(500).json({ error: "server error" });
  }
};
export const readController: RequestHandler = async (request, response) => {};
export const updateController: RequestHandler = async (request, response) => {};
export const deleteController: RequestHandler = async (request, response) => {};
