import type { RequestHandler } from "express";
import { pool } from "../../../migrations/db";
import bcrypt from "bcrypt";
import { signInSchema, signUpSchema } from "./schema";
import jwt from "jsonwebtoken";
import "dotenv/config";

export const signupController: RequestHandler = async (request, response) => {
  try {
    const checkInput = signUpSchema.safeParse(request.body);

    if (!checkInput.success)
      return response.status(400).json({ error: "invalid email or password" });

    const { email, password } = checkInput.data;

    const userData = await pool.query(
      "SELECT email FROM users WHERE email=$1",
      [email],
    );

    if (userData.rowCount)
      return response
        .status(409)
        .json({ error: "email alredy exists in db try login" });

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.query("INSERT INTO users (email,password) VALUES ($1,$2)", [
      email,
      hashedPassword,
    ]);

    return response.status(201).json({ message: "user registered" });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  }
};

export const signinController: RequestHandler = async (request, response) => {
  try {
    const checkInput = signInSchema.safeParse(request.body);

    if (!checkInput.success)
      return response.status(400).json({ error: "invalid email or password" });

    const { email, password } = checkInput.data;

    const userData = await pool.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);

    if (!userData.rowCount)
      return response
        .status(409)
        .json({ error: "user does not exist pls signup" });

    const checkPassword = await bcrypt.compare(
      password,
      userData.rows[0].password,
    );

    if (!checkPassword) {
      return response.status(400).json({ error: "wrong password" });
    }

    const token = jwt.sign(
      { userId: userData.rows[0].id },
      process.env.JWT_SECRET!,
    );

    return response.status(200).json({ token });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "server error",
    });
  }
};
