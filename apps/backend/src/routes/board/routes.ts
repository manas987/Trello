import { Router } from "express";
import {
  createController,
  deleteController,
  readController,
  updateController,
} from "./controllers";
import { authMiddleware } from "../../middleware/auth";

export const boardRouter = Router();

boardRouter.post("/create", authMiddleware, createController);

boardRouter.get("/read", authMiddleware, readController);

boardRouter.patch("/update", authMiddleware, updateController);

boardRouter.delete("/delete", authMiddleware, deleteController);
