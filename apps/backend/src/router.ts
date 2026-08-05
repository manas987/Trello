import { Router } from "express";

export const router = Router();

router.use("auth");
router.use("organization");
router.use("board");
router.use("section");
router.use("issue");
router.use("comment");
router.use("membership");
router.use("invite");
