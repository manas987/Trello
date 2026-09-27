import { Router } from "express";
import {
  createController,
  deleteController,
  readController,
  updateController,
} from "./controllers";
import { authMiddleware } from "../../middleware/auth";

export const commentRouter = Router();

commentRouter.post("/create", authMiddleware, createController);

commentRouter.get("/read", authMiddleware, readController);

commentRouter.patch("/update", authMiddleware, updateController);

commentRouter.delete("/delete", authMiddleware, deleteController);
