import { Role } from "../../../generated/prisma/enums";
import { PaymentWhereInput } from "../../../generated/prisma/models";
import { IQuary } from "../../interface";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const getMyPayment = async (query: IQuary, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const patient = await prisma.patient.findUnique({
		where: {
			userId: user.userId,
		},
	});
	if (!patient) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient Pfofile Not Found");
	}
	const andConditions: PaymentWhereInput[] = [
		{
			appointment: {
				patientId: patient.id,
			},
		},
	];
	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const appointment = await prisma.payment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			appointment: {
				include: {
					doctor: true,
					schedule: true,
				},
			},
		},
	});
	const total = await prisma.payment.count({
		where: {
			AND: andConditions,
		},
	});
	return {
		data: appointment,
		meta: {
			page: page,
			limit: limit,
			total: total,
			totalPages: Math.ceil(total / limit),
		},
	};
};
const getAllPayment = async (query: IQuary) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: PaymentWhereInput[] = [];
	if (query.patienteMail) {
		andConditions.push({
			appointment: {
				patient: {
					email: query.email,
				},
			},
		});
	}
	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const appointment = await prisma.payment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			appointment: {
				include: {
					doctor: true,
					schedule: true,
				},
			},
		},
	});
	const total = await prisma.payment.count({
		where: {
			AND: andConditions,
		},
	});
	return {
		data: appointment,
		meta: {
			page: page,
			limit: limit,
			total: total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getSinglePayment = async (paymentId: string, user: RequestUser) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },

		include: {
			appointment: {
				include: {
					patient: true,
					doctor: true,
					schedule: true,
				},
			},
		},
	});
	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment Not Found");
	}
	if (user.role === Role.PATIENT) {
		if (payment.appointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"You Are Not Allowed To View This Appointment",
			);
		}
	}
	if (user.role === Role.PATIENT) {
		if (payment.appointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"You Are Not Allowed To View This Appointment",
			);
		}
	}
	return payment;
};

export const paymentServices = {
	getMyPayment,
	getAllPayment,
	getSinglePayment,
};
