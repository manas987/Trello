import { Router } from "express";
import {
  createService,
  deleteService,
  readService,
  updateService,
} from "./service";

export const commentRouter = Router();

commentRouter.post("/create", createService);

commentRouter.get("/read", readService);

commentRouter.patch("/update", updateService);

commentRouter.delete("/delete", deleteService);
