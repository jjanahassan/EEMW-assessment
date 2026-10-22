import { Router } from "express";
import { authService } from "../../container";
import { AuthController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.schemas";
import { validateBody } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { loginLimiter } from "../../middleware/rateLimit";

const router = Router();
const controller = new AuthController(authService);

router.post("/register", validateBody(registerSchema), controller.register);
router.post("/login", loginLimiter, validateBody(loginSchema), controller.login);
router.get("/me", authenticate, controller.me);

export { router as authRouter };