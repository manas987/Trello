import { Router } from "express";
import {
  createController,
  deleteController,
  readReceivedController,
  readSentController,
  acceptController,
} from "./controller";
import { authMiddleware } from "../../middleware/auth";

export const inviteRouter = Router();

inviteRouter.post("/create", authMiddleware, createController);

inviteRouter.get("/received", authMiddleware, readReceivedController);

inviteRouter.get("/sent", authMiddleware, readSentController);

inviteRouter.post("/accept", authMiddleware, acceptController);

inviteRouter.delete("/delete", authMiddleware, deleteController);
