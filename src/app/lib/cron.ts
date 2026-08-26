import cron from "node-cron";
import { prisma } from "./prisma";
import { DoctorCertificationStatus, Role } from "../../generated/prisma/enums";

export const deleteUnVerifiedDoctor = async () => {
	cron.schedule("*/2 * * * * *", async() => {
       try {
         const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

        const deletedDoctors = await prisma.user.deleteMany({
            where:{
                role:Role.DOCTOR,
                emailVerified:false,
                createdAt:{ lt:oneHourAgo},
                doctor:{
                    verificationStatus:DoctorCertificationStatus.PENDING
                }
            }
        })
        if(deletedDoctors.count > 0){
            console.log(`Cron: Deleted ${deletedDoctors.count} Unverified email doctor application older than 1 hour`)
        }
       } catch (error) {
        console.log("Cron: Failed to deleted unverified doctor appplication ",error)
       }

	});
};
