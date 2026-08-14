import { Router } from "express";
import { authRouter } from "./routes/auth/routes";
import { organizationRouter } from "./routes/organization/routes";
import { boardRouter } from "./routes/board/routes";
import { sectionRouter } from "./routes/section/routes";
import { issueRouter } from "./routes/issue/routes";
import { commentRouter } from "./routes/comment/routes";
import { membershipRouter } from "./routes/membership/routes";
import { inviteRouter } from "./routes/invite/routes";

export const router = Router();

router.use("/auth", authRouter);
router.use("/organization", organizationRouter);
router.use("/board", boardRouter);
router.use("/section",sectionRouter);
router.use("/issue",issueRouter);
router.use("/comment",commentRouter);
router.use("/membership",membershipRouter);
router.use("/invite",inviteRouter);
