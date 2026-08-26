

import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { doctorController } from "./doctors.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.post("/apply",

    upload.fields([
        {
            name:"resume",
            maxCount:1
        },{
            name:'additionalFiles',
            maxCount:3
        }
    ])
    ,doctorController.applyDoctors );


    router.post("/apply-as-doctor/verify-email",doctorController.verifyDoctorEmail)

export const DoctorsRoute = router;