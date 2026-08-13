import { Router } from "express";
import {
  createController,
  deleteController,
  readController,
  updateController,
} from "./controllers";
import { authMiddleware } from "../../middleware/auth";

export const organizationRouter = Router();

organizationRouter.post("/create", authMiddleware, createController);

organizationRouter.get("/read", authMiddleware, readController);

organizationRouter.patch("/update", authMiddleware, updateController);

organizationRouter.delete("/delete", authMiddleware, deleteController);
