import { Router } from "express";
import { signinController, signupController } from "./controllers";

export const authRouter = Router();

authRouter.post("/signup", signupController);

authRouter.post("/signin", signinController);
