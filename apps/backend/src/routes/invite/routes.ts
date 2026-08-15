import { Router } from "express";
import {
  createController,
  deleteController,
  readReceivedController,
  readSentController,
  acceptController,
} from "./controller";

export const inviteRouter = Router();

inviteRouter.post("/create", createController);

inviteRouter.get("/received", readReceivedController);

inviteRouter.get("/sent", readSentController);

inviteRouter.post("/accept", acceptController);

inviteRouter.delete("/delete", deleteController);
