import { Router } from "express";
import { signinController, signupController } from "./controllers";

export const authRouter = Router();

authRouter.use("/signup", signupController);

authRouter.use("/signin", signinController);
