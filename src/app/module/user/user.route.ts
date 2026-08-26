

import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { userControllers } from "./user.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.patch("/profile-image" ,
    auth(Role.ADMIN,Role.DOCTOR,Role.PATIENT,Role.SUPER_ADMIN),
    upload.single("profileImage"),
    userControllers.uploadProfileImage);


export const userRoutes = router;
