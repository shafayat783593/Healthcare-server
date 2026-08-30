import { addDays, differenceInMinutes, isAfter, isSameDay, startOfDay } from "date-fns";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import {
	IcreateSchedulePayload,
	IupdateSchedulePayload,
} from "./schedule.interface";

import httpStatus from "http-status";
import { email, tuple } from "zod";
import { IQuary } from "../../interface";
import {
	DoctorWhereInput,
	ScheduleWhereInput,
} from "../../../generated/prisma/models";
import { ScheduleStatus } from "../../../generated/prisma/enums";
import { isDataView } from "node:util/types";

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



	if (!isSameDay(payload.startDate, payload.endDate)) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Start Date Time And Date Time Must Be on the Same Day",
		);
	}

	if (isAfter(payload.startDate, payload.endDate)) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Start Date Time Cannot Be after End Date Time",
		);
	}

	const startOfTheDay = startOfDay(payload.startDate);
	const startOfNextDay = addDays(startOfTheDay, 1);

	const existingScheduleOnThisDate = await prisma.schedule.findFirst({
		where: {
			doctorId: doctor.id,
			isDeleted: false,
			startDateTime: {
				gte: startOfTheDay,
				lt: startOfNextDay,
			},
		},
	});

	if (existingScheduleOnThisDate) {
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
		include: {
			doctor: {
				select: {
					name: true,
					email: true,
					contactNumber: true,
				},
			},
		},
	});
	return schedule;
};

const getMySchedules = async (query: IQuary, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: ScheduleWhereInput[] = [
		{
			doctorId: doctor?.id,
		},
		{
			isDeleted: false,
		},
	];

	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const schedules = await prisma.schedule.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});
	const total = await prisma.schedule.count({
		where: {
			AND: andConditions,
		},
	});
	return {
		data: schedules,
		meta: {
			page: page,
			limit: limit,
			total: total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getAllSchedules = async (query: IQuary) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: ScheduleWhereInput[] = [];

	if (query.doctorId) {
		andConditions.push({
			doctorId: query.doctorId,
		});
	}
	if (query.email) {
		andConditions.push({
			doctor: {
				email: query.email,
			},
		});
	}
	if (query.searchTerm) {
		andConditions.push({
			doctor: {
				OR: [
					{ name: { contains: query.searchTerm, mode: "insensitive" } },
					{ email: { contains: query.searchTerm, mode: "insensitive" } },
					{
						specialization: {
							contains: query.searchTerm,
							mode: "insensitive",
						},
					},
					{
						licenseNumber: {
							contains: query.searchTerm,
							mode: "insensitive",
						},
					},
				],
			},
		});
	}
	const schedules = await prisma.schedule.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});
	const total = await prisma.schedule.count({
		where: {
			AND: andConditions,
		},
	});
	return {
		data: schedules,
		meta: {
			page: page,
			limit: limit,
			total: total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getScheduleById = async (scheduleId: string) => {
	const schedule = await prisma.schedule.findUnique({
		where: { id: scheduleId },
		include: {
			doctor: {
				select: {
					id: true,
					name: true,
					email: true,
					specialization: true,
					userId: true,
				},
			},
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});
	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "schedule NOt Found");
	}

	return schedule;
};

const updateSchedule = async (
	scheduleId: string,
	payload: IupdateSchedulePayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "doctor Profile Not found");
	}
	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
			doctorId: doctor.id,
		},
	});
	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "schedule NOt Found");
	}
	if (
		schedule.status === ScheduleStatus.PUBLISHED &&
		schedule.totalSlots !== schedule.availableSlots
	) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Schedule once Published And Appointment Booked can not be Updated ",
		);
	}

	// const updateData: IupdateSchedulePayload = {}
	// if(payload.mettingLink){
	// 	updateData.mettingLink = payload.mettingLink || schedule.meetingLink
	// }

	payload.mettingLink = payload.mettingLink || schedule.meetingLink;
	payload.startDate = payload.startDate || schedule.startDateTime;
	payload.endDate = payload.endDate || schedule.endDateTime;


		if (!isSameDay(payload.startDate, payload.endDate)) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Start Date Time And Date Time Must Be on the Same Day",
		);
	}

	if (isAfter(payload.startDate, payload.endDate)) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Start Date Time Cannot Be after End Date Time",
		);
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

	const updatedschedule = await prisma.schedule.update({
		where: {
			id: schedule.id,
		},
		data: {
			startDateTime: payload.startDate,
			endDateTime: payload.endDate,
			meetingLink: payload.mettingLink,
			totalSlots,
			availableSlots: totalSlots,
			doctorId: doctor.id,
		},
		include: {
			doctor: {
				select: {
					name: true,
					email: true,
					contactNumber: true,
				},
			},
		},
	});
	return updatedschedule;
};

const publishSchedule = async (scheduleId: string, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "doctor Profile Not found");
	}
	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
			doctorId: doctor.id,
		},
	});
	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "schedule NOt Found");
	}
	if (schedule.status === ScheduleStatus.PUBLISHED) {
		throw new AppError(httpStatus.CONFLICT, "Schedule Is ALready Published");
	}

	const publishedSchedule = await prisma.schedule.update({
		where: {
			id: schedule.id,
		},
		data: {
			status: ScheduleStatus.PUBLISHED,
		},
	});
	return publishedSchedule;
};
const deleteSchedule = async (scheduleId: string, user: RequestUser) => {
	const doctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "doctor Profile Not found");
	}
	const schedule = await prisma.schedule.findUnique({
		where: {
			id: scheduleId,
			doctorId: doctor.id,
		},
	});
	if (!schedule || schedule.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "schedule NOt Found");
	}
	if (
		schedule.status === ScheduleStatus.PUBLISHED &&
		schedule.totalSlots !== schedule.availableSlots
	) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Schedule once Published And Appointment Booked can not be deleted ",
		);
	}

	const deletedSchedule = await prisma.schedule.update({
		where: {
			id: schedule.id,
		},
		data: {
			isDeleted: true,
			deletedAt: new Date(),
		},
	});

	return deletedSchedule;
};

const getTodaysSchedules = async (query: IQuary) => {
	if (!query.doctorId) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Doctor Id must be Provided In Quary",
		);
	}
	const doctor = await prisma.doctor.findUnique({
		where: { id: query.doctorId },
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const now = new Date();
	const startOfToday = startOfDay(now);
	const startOfTomorrow = addDays(startOfToday, 1);

	const andConditions: ScheduleWhereInput[] = [
		{
			doctorId: query.doctorId,
		},
		{
			isDeleted: false,
		},
		{
			status: ScheduleStatus.PUBLISHED,
		},
		{
			startDateTime: {
				gte: startOfToday,
				lt: startOfTomorrow,
				gt: now,
			},
		},
		{
			availableSlots: {
				gt: 0,
			},
		},
	];

	const schedules = await prisma.schedule.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			appointments: {
				include: {
					patient: true,
				},
			},
		},
	});
	const total = await prisma.schedule.count({
		where: {
			AND: andConditions,
		},
	});
	return {
		data: schedules,
		meta: {
			page: page,
			limit: limit,
			total: total,
			totalPages: Math.ceil(total / limit),
		},
	};
};
export const scheduleService = {
	createShedule,
	getMySchedules,
	getAllSchedules,
	getScheduleById,
	updateSchedule,
	publishSchedule,
	deleteSchedule,
	getTodaysSchedules,
};
