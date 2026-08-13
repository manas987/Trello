import { Router } from "express";
import {
  createController,
  deleteController,
  readController,
  updateController,
} from "./controllers";
import { authMiddleware } from "../../middleware/auth";

export const issueRouter = Router();

issueRouter.post("/create", authMiddleware, createController);

issueRouter.get("/read", authMiddleware, readController);

issueRouter.patch("/update", authMiddleware, updateController);

issueRouter.delete("/delete", authMiddleware, deleteController);
