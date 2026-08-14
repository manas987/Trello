import { Router } from "express";
import {
  createController,
  deleteController,
  readController,
  updateController,
} from "./controllers";

export const commentRouter = Router();

commentRouter.post("/create", createController);

commentRouter.get("/read", readController);

commentRouter.patch("/update", updateController);

commentRouter.delete("/delete", deleteController);
