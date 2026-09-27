import { Router } from "express";
import {
  createController,
  deleteController,
  moveController,
  readController,
  updateController,
} from "./controllers";
import { authMiddleware } from "../../middleware/auth";

export const issueRouter = Router();

issueRouter.post("/create", authMiddleware, createController);

issueRouter.get("/read", authMiddleware, readController);

issueRouter.patch("/update", authMiddleware, updateController);

issueRouter.patch("/move", authMiddleware, moveController);

issueRouter.delete("/delete", authMiddleware, deleteController);
