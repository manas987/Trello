import { Router } from "express";
import {
  changeRoleController,
  kickController,
  leaveController,
  readController,
} from "./controller";
import { authMiddleware } from "../../middleware/auth";

export const membershipRouter = Router();

membershipRouter.get("/read", authMiddleware, readController);

membershipRouter.patch("/updateRole", authMiddleware, changeRoleController);

membershipRouter.delete("/kick", authMiddleware, kickController);

membershipRouter.delete("/delete", authMiddleware, leaveController);
