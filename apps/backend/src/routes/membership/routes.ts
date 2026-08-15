import { Router } from "express";
import { leaveController, readController } from "./controller";
import { authMiddleware } from "../../middleware/auth";

export const membershipRouter = Router();

membershipRouter.get("/read", authMiddleware, readController);

membershipRouter.delete("/delete", authMiddleware, leaveController);
