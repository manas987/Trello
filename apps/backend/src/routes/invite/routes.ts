import { Router } from "express";
import {
  createService,
  deleteService,
  readService,
  updateService,
} from "./service";

export const inviteRouter = Router();

inviteRouter.post("/create", createService);

inviteRouter.get("/read", readService);

inviteRouter.patch("/update", updateService);

inviteRouter.delete("/delete", deleteService);
