import { Router } from "express";
import {
  createService,
  deleteService,
  readService,
  updateService,
} from "./service";

export const sectionRouter = Router();

sectionRouter.post("/create", createService);

sectionRouter.get("/read", readService);

sectionRouter.patch("/update", updateService);

sectionRouter.delete("/delete", deleteService);
