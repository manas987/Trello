import { Router } from "express";
import { authRouter } from "./routes/auth/routes";
import { organizationRouter } from "./routes/organization/routes";

export const router = Router();

router.use("/auth", authRouter);
router.use("/organization", organizationRouter);
// router.use("/board");
// router.use("/section");
// router.use("/issue");
// router.use("/comment");
// router.use("/membership");
// router.use("/invite");
