import { Router } from "express";
import {
  createService,
  deleteService,
  readOneService,
  readService,
  updateService,
} from "./service";

export const issueRouter = Router();

issueRouter.post("/create", createService);

issueRouter.get("/read", readService);

issueRouter.get("/readOne", readOneService);

issueRouter.patch("/update", updateService);

issueRouter.delete("/delete", deleteService);
