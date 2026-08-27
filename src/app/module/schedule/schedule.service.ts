import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { IcreateSchedulePayload } from "./schedule.interface";

import httpStatus from "http-status";
import { email } from "zod";
const createShedule = async (
	payload: IcreateSchedulePayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile NOt Found");
	}

	const startOfTheDay = startOfDay(payload.startDate);
	const startOfNextDay = addDays(startOfTheDay, 1);

	const existingScheduleOnThisDat = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,
			startDateTime: {
				get: startOfTheDay,
				lt: startOfNextDay,
			},
		},
	});

	if (existingScheduleOnThisDat) {
		throw new AppError(
			httpStatus.CONFLICT,
			"You Already Have Schedule For This Date ",
		);
	}

	const durationInMinutes = differenceInMinutes(
		payload.startDate,
		payload.endDate,
	);
	const MINITES_ALLOCATED_PER_SLOT = 20;

	const totalSlots = durationInMinutes / MINITES_ALLOCATED_PER_SLOT;
	const schedule = await prisma.schedule.create({
		data: {
			startDateTime: payload.startDate,
			endDateTime: payload.endDate,
			meetingLink: payload.mettingLink,
			totalSlots,
			availableSlots: totalSlots,
			doctorId: doctor.id,
		},
        include:{
            doctor:{
             select:{
                name:true,
                email:true,
                contactNumber:true
                
             }
            }
        }
	});
    return schedule
};

export const scheduleService = {
	createShedule,
};
