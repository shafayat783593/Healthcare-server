import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { doctorController } from "./doctors.controller";
import { upload } from "../../lib/multer";
import { validateRequest } from "../../middleware/validateRequest";
import { UpdateDoctorProfileValidationZodSchema } from "./doctors.validation";

const router = Router();

router.post(
    "/apply",
    upload.fields([
        { name: "resume", maxCount: 1 },
        { name: "additionalFiles", maxCount: 3 },
    ]),
    doctorController.applyDoctors,
);

// REMOVED auth() guard so applicants can verify without admin tokens
router.post(
    "/apply-as-doctor/verify-email",
    doctorController.verifyDoctorEmail,
);

router.get(
    "/all-doctors",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    doctorController.getAllDoctor,
);

router.post(
    "/approve-doctor",
    auth(Role.ADMIN, Role.SUPER_ADMIN),
    doctorController.approveDoctor,
);

router.patch(
    "/update-my-profile",
    auth(Role.DOCTOR),
    validateRequest(UpdateDoctorProfileValidationZodSchema),
    doctorController.updateDoctorProfile,
);

// Public doctor-discovery routes (no auth)
router.get(
    "/public/available-today",
    doctorController.getAvailableDoctorByTodaysSchedule,
);

router.get(
    "/public/all-doctors",
    doctorController.getAllDoctorsListPublic,
);

router.get(
    "/public/:doctorId",
    doctorController.getSingleDoctorPublicProfile,
);

export const DoctorsRoute = router;