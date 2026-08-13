import { Router } from "express";
import {
  createController,
  deleteController,
  readController,
  updateController,
} from "./controllers";
import { authMiddleware } from "../../middleware/auth";

export const sectionRouter = Router();

sectionRouter.post("/create", authMiddleware, createController);

sectionRouter.get("/read", authMiddleware, readController);

sectionRouter.patch("/update", authMiddleware, updateController);

sectionRouter.delete("/delete", authMiddleware, deleteController);
