import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { Patinvalidation } from "./auth.validation";

const router = Router();

router.post("/register", validateRequest(Patinvalidation.patientRegistrationZodSchema), AuthController.registerPatient);
router.post("/verify-email", validateRequest(Patinvalidation.patientVerifyZodSchema), AuthController.verifyPatientEmail);
router.post("/login", validateRequest(Patinvalidation.laginzod), AuthController.loginUser);
router.get(
	"/me",
	auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
	AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", AuthController.googleLogin);
router.post("/forgot-password", validateRequest(Patinvalidation.ForgotPasswordZodSchema), AuthController.forgotPassword)
router.post("/reset-password", validateRequest(Patinvalidation.resetPasswordZodSchema),AuthController.resetPassword)
export const AuthRoutes = router;
