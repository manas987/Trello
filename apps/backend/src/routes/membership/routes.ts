import { Router } from "express";
import {
  createService,
  deleteService,
  readService,
  updateService,
} from "./service";

export const membershipRouter = Router();

membershipRouter.post("/create", createService);

membershipRouter.get("/read", readService);

membershipRouter.patch("/update", updateService);

membershipRouter.delete("/delete", deleteService);
