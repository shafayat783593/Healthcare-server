import httpStatus from "http-status";
import {
	AppointmentStatus,
	PaymentStatus,
	Role,
	ScheduleStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { RequestUser } from "../../middleware/checkAuth";
import {
	IBookingAppointmentPayload,
	ICancleAppointmentPayload,
	IPayAppointmentPayload,
	IUpdateAppointmentStatusPayload,
} from "./appoinment.interface";
import { addMinutes, isAfter, isBefore, isSameDay, subHours } from "date-fns";
import { no } from "zod/locales";
import { transporter } from "../../lib/nodmailer";
import { generateInvoicePdf } from "../../utils/PDFDocument";
import { IQuary } from "../../interface";
import { AppointmentWhereInput } from "../../../generated/prisma/models";

const bookAppointment = async (
	payload: IBookingAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const patient = await prisma.patient.findUnique({
			where: {
				userId: user.userId,
			},
		});
		if (!patient) {
			throw new AppError(httpStatus.NOT_FOUND, "Patient Profile Not Found");
		}

		const schedule = await prisma.schedule.findUnique({
			where: {
				id: payload.scheduledId,
			},
			include: { doctor: true },
		});
		if (!schedule) {
			throw new AppError(httpStatus.NOT_FOUND, "Schedule Not Found");
		}

		if (schedule?.status !== ScheduleStatus.PUBLISHED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This is Schedule Is Not Published Yes",
			);
		}

		const now = new Date();
		if (!isSameDay(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This is Schedule Is Not Available Today",
			);
		}

		// if (!isBefore(now, schedule.startDateTime)) {
		// throw new AppError(
		// 	httpStatus.BAD_REQUEST,
		// 	"This Schedule Has Already Started",
		// );
		// }

		if (isAfter(now, schedule.startDateTime)) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This Schedule Has Already Started",
			);
		}

		const existingAppointment = await prisma.appointment.findFirst({
			where: {
				patientId: patient.id,
				scheduleId: schedule.id,
				// status:{not:AppointmentStatus.CANCELLED}
			},
		});

		if (existingAppointment?.status === AppointmentStatus.PENDING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you Already have  A Pending Appointment Please Pay For that",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.ONGOING) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you Already have  A Ongoing Appointment",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.COMPLETED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you Already have complated Appointment On This Schedule . plase Try  Again Another Day",
			);
		}
		if (existingAppointment?.status === AppointmentStatus.CONFIRMED) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"you Already have ConFirmed Appointment",
			);
		}

		if (schedule.availableSlots === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				" Is schedule Is Fully Bookd ",
			);
		}

		if (!schedule.doctor.consultationFee) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				" Doctor Has Not Set A Consultation Fee Yet ",
			);
		}
		const amount = schedule.doctor.consultationFee.toString();

		const appointment = await tx.appointment.create({
			data: {
				status: AppointmentStatus.PENDING,
				patientId: patient.id,
				doctorId: schedule.doctor.id,
				scheduleId: schedule.id,
			},
		});

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(httpStatus.BAD_GATEWAY, "No bKash access token found");
		}

		const bkashCreatePaymentRespons = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					mode: "0011",
					// payerReference: "0123456789", // user email or phone number
					payerReference: user.email,
					callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
					amount: amount,
					currency: "BDT",
					intent: "sale",
					// merchantInvoiceNumber: "Inv4" // appointment id
					merchantInvoiceNumber: appointment.id,
				}),
			},
		);

		const bkashCreatePaymentResult = await bkashCreatePaymentRespons.json();

		// payment create .............
		await tx.payment.create({
			data: {
				merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,

				appointmentId: appointment.id,

				amount: amount,

				gatewayResponse: bkashCreatePaymentResult,

				bkashPaymentId: bkashCreatePaymentResult.paymentID,

				payerReference: user.email,
			},
		});

		return {
			paymetURL: bkashCreatePaymentResult.bkashURL,
		};
	});

	return transactionResult;
};

const payAppointment = async (
	payload: IPayAppointmentPayload,
	user: RequestUser,
) => {
	const appointmentId = payload.appointmentId;
	const existingAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},
		include: {
			schedule: {
				include: {
					doctor: true,
				},
			},
		},
	});
	if (!existingAppointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exist");
	}
	if (existingAppointment.status !== "PENDING") {
		throw new AppError(httpStatus.BAD_REQUEST, "Appointment Is Not Pending");
	}

	if (!existingAppointment.schedule.doctor.consultationFee) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			" Doctor Has Not Set A Consultation Fee Yet ",
		);
	}
	const amount = existingAppointment.schedule.doctor.consultationFee.toString();

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No bKash access token found");
	}

	const bkashCreatePaymentRespons = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
				// payerReference: "0123456789", // user email or phone number
				payerReference: user.email,
				callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
				amount: amount,
				currency: "BDT",
				intent: "sale",
				// merchantInvoiceNumber: "Inv4" // appointment id
				merchantInvoiceNumber: existingAppointment.id,
			}),
		},
	);

	const bkashCreatePaymentResult = await bkashCreatePaymentRespons.json();
	await prisma.payment.update({
		where: {
			appointmentId: existingAppointment.id,
		},
		data: {
			merchantInvoiceNumber: bkashCreatePaymentResult.merchantInvoiceNumber,
			gatewayResponse: bkashCreatePaymentResult,

			bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
	});

	return {
		paymentUrl: bkashCreatePaymentResult.bkashURL,
	};
};
// if (
// 	existingAppointment.status === "CANCELLED" ||
// 	existingAppointment.status === "ONGOING" ||
// 	existingAppointment.status === "COMPLETED"
// ) {
// 	const appointmentStatus = existingAppointment.status;
// 	throw new Error(
// 		`Appointment is already ${appointmentStatus.toLowerCase()}`,
// 	);
// }

const bookAppointmentCallback = async (query: Record<string, any>) => {
	const paymentId = query.paymentID;
	const status = query.status;

	if (!paymentId) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment ID missing");
	}

	if (!status) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment status is missing");
	}

	// --------------------------------------------------
	// 1. Get bKash token OUTSIDE Prisma transaction
	// --------------------------------------------------
	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No bKash access token found");
	}

	// --------------------------------------------------
	// 2. Execute bKash payment OUTSIDE Prisma transaction
	// --------------------------------------------------
	const executedPaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key!,
			},
			body: JSON.stringify({
				paymentID: paymentId,
			}),
		},
	);

	const executedPaymentResult = await executedPaymentResponse.json();

	console.log("bKash Execute Response:", executedPaymentResult);

	// --------------------------------------------------
	// 3. Now do ONLY database operations in transaction
	// --------------------------------------------------
	const transactionResult = await prisma.$transaction(async (tx) => {
		if (status === "success") {
			const appointmentId =
				executedPaymentResult.merchantInvoiceNumber as string;
			if (!appointmentId) {
				throw new AppError(
					httpStatus.BAD_GATEWAY,
					"Appointment ID missing from bKash response",
				);
			}
			const appointement = await tx.appointment.findUnique({
				where: {
					id: appointmentId,
				},
				include: {
					schedule: true,
					patient: true,
				},
			});
			if (!appointement) {
				throw new AppError(
					httpStatus.BAD_GATEWAY,
					"Appointment missing from bKash response",
				);
			}

			const alreadyBookiedSlots =
				appointement.schedule.totalSlots - appointement.schedule.availableSlots;

			const serialNumber = alreadyBookiedSlots + 1;

			const joiningTime = addMinutes(
				appointement.schedule.startDateTime,
				(serialNumber - 1) * 20,
			);

			await tx.appointment.update({
				where: {
					id: appointmentId,
				},
				data: {
					status: AppointmentStatus.CONFIRMED,
					joiningTime,
					serialNumber,
				},
			});
			const newAvailableSlots = appointement?.schedule.availableSlots - 1;

			await tx.schedule.update({
				where: {
					id: appointement.schedule.id,
				},
				data: {
					availableSlots: newAvailableSlots,
				},
			});

			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.PAID,
					bkashTrxId: executedPaymentResult.trxID,
					paidAt: executedPaymentResult.paymentExecuteTime,
					gatewayResponse: executedPaymentResult,
				},
			});

			const pdfBuffer = await generateInvoicePdf({
				patientName: appointement.patient.name, // patient model-এ name থাকলে
				patientEmail: appointement.patient.email,
				appointmentId: appointement.id,
				trxId: executedPaymentResult.trxID,
				amount: executedPaymentResult.amount || "1000",
				date: new Date().toLocaleDateString(),
				joiningTime: joiningTime.toISOString(),
				serialNumber: serialNumber,
			});

			await transporter.sendMail({
				from: config.email_sender,
				to: appointement.patient.email,
				subject: "Your Appointment Invoice - PH Healthcare System",
				html: `<p>Dear ${appointement.patient.name || "Patient"},</p><p>Your appointment payment was successful. Please find your invoice attached below.</p>`,
				attachments: [
					{
						filename: `Invoice_${appointement.id}.pdf`,
						content: pdfBuffer,
						contentType: "application/pdf",
					},
				],
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=success`,
			};
		}

		if (status === "failure") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.FAILED,
					gatewayResponse: executedPaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=failure`,
			};
		}

		if (status === "cancel") {
			await tx.payment.update({
				where: {
					bkashPaymentId: paymentId,
				},
				data: {
					status: PaymentStatus.CANCELLED,
					gatewayResponse: executedPaymentResult,
				},
			});

			return {
				redirectUrl: `${config.frontend_url}/dashboard/my-appointments?status=cancel`,
			};
		}

		return {
			redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error=payment-failed`,
		};
	});

	return transactionResult;
};

const cancelAppointment = async (
	payload: ICancleAppointmentPayload,
	user: RequestUser,
) => {
	const transactionResult = await prisma.$transaction(async (tx) => {
		const appointmentId = payload.appointmentId;

		const existingAppointment = await tx.appointment.findUnique({
			where: {
				id: appointmentId,
				patient: {
					email: user.email,
				},
			},
			include: {
				schedule: true,
				payment: true,
			},
		});

		if (!existingAppointment) {
			throw new AppError(httpStatus.NOT_FOUND, "Appointment Does Not Exist");
		}

		if (
			existingAppointment.status === "ONGOING" ||
			existingAppointment.status === "COMPLETED"
		) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment Ongoing or Completed",
			);
		}

		if (existingAppointment.status === "CANCELLED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Appointment Already Cancelled",
			);
		}

		const updatedAppointment = await tx.appointment.update({
			where: {
				id: existingAppointment.id,
			},

			data: {
				status: AppointmentStatus.CANCELLED,
			},
		});

		await tx.schedule.update({
			where: {
				id: existingAppointment.schedule.id,
			},
			data: {
				availableSlots: { increment: 1 },
			},
		});

		const now = new Date();

		const startDateTime = existingAppointment.schedule.startDateTime;

		const refundCutOfTime = subHours(startDateTime, 1);

		const isEligibleForRefund = isBefore(now, refundCutOfTime);

		if (isEligibleForRefund) {
			const bkashIdToken = await getBkashIdToken();

			if (!bkashIdToken) {
				throw new AppError(
					httpStatus.BAD_GATEWAY,
					"No bKash access token found",
				);
			}

			const bkashRefundPaymentResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						Authorization: bkashIdToken,
						"X-App-Key": config.bkash_app_key,
					},
					body: JSON.stringify({
						paymentID: existingAppointment.payment?.bkashPaymentId,
						trxID: existingAppointment.payment?.bkashTrxId,
						amount: existingAppointment.payment?.amount.toString(),
						sku: "Appointment Cancellation",
						reason: "Patient Cancelled The Appointment",
					}),
				},
			);

			const bkashRefundPaymentResult = await bkashRefundPaymentResponse.json();

			await tx.payment.update({
				where: {
					appointmentId: existingAppointment.id,
				},
				data: {
					refundTrxId: bkashRefundPaymentResult.refundTrxID,
					refundAt: bkashRefundPaymentResult.completedTime,
					refundAmount: bkashRefundPaymentResult.amount,
					reason: "Patient Cancelled The Appointment",
					status: PaymentStatus.REFUNDED,
					gatewayResponse: bkashRefundPaymentResult,
				},
			});
		}
		// refund process

		const newPaymentInfo = await prisma.payment.findUnique({
			where: {
				appointmentId: existingAppointment.id,
			},
		});

		return {
			appointment: updatedAppointment,
			payment: newPaymentInfo,
		};
	});

	return transactionResult;
};

// Doctor Only update state ....Confired => ongoing => completed
const updateAppointmentStatus = async (
	appointmentId: string,
	payload: IUpdateAppointmentStatusPayload,
	user: RequestUser,
) => {
	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
	}
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
			doctorId: doctor.id,
		},
	});
	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Appointment  Not Found");
	}

	if (appointment.status === AppointmentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Appointment is Already completed",
		);
	}
	if (appointment.status === AppointmentStatus.CANCELLED) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Confirmed Appointment Must Be Ongoing At First",
		);
	}
	if (appointment.status === AppointmentStatus.PENDING) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Appointment is Pending You Can change status appointment is confrom",
		);
	}

	if (appointment.status === AppointmentStatus.CONFIRMED) {
		if (payload.status !== "ONGOING") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Confirmed Appointment Must Be Ongoing At First",
			);
		}

		await prisma.appointment.update({
			where: {
				id: appointment.id,
			},
			data: {
				status: AppointmentStatus.ONGOING,
			},
		});
	}
	if (appointment.status === AppointmentStatus.ONGOING) {
		if (payload.status !== "COMPLETED") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Ongoing Appointment Must Be Completed",
			);
		}
		await prisma.appointment.update({
			where: {
				id: appointment.id,
			},
			data: {
				status: AppointmentStatus.COMPLETED,
			},
		});
	}
	const updatedAppointment = await prisma.appointment.findUnique({
		where: {
			id: appointment.id,
		},
	});
	return updatedAppointment;
};

// patient appointments

const getmyAppointment = async (query: IQuary, user: RequestUser) => {
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
	const andConditions: AppointmentWhereInput[] = [
		{
			patientId: patient.id,
		},
	];
	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const appointment = await prisma.appointment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			doctor: {
				select: {
					id: true,
					name: true,
					specialization: true,
				},
			},
		},
	});
	const total = await prisma.appointment.count({
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
const getDoctoreAppointment = async (query: IQuary, user: RequestUser) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const doctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});
	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient Pfofile Not Found");
	}
	const andConditions: AppointmentWhereInput[] = [
		{
			doctorId: doctor.id,
		},
	];
	if (query.status) {
		andConditions.push({ status: query.status });
	}

	const appointment = await prisma.appointment.findMany({
		where: {
			AND: andConditions,
		},
		take: limit,
		skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			doctor: {
				select: {
					id: true,
					name: true,
					specialization: true,
				},
			},
		},
	});
	const total = await prisma.appointment.count({
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

// admin or superAdmin ..
const getAllAppointments = async (query:IQuary) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc"

	const andConditions: AppointmentWhereInput[] = [];

	if (query.status) {
		andConditions.push({ status: query.status });
	}

	if (query.doctorId) {
		andConditions.push({ doctorId: query.doctorId });
	}

	if (query.patientId) {
		andConditions.push({ patientId: query.patientId });
	}

	if(query.doctorEmail){
		andConditions.push({
			doctor : {
				email : query.doctorEmail
			}
		})
	}
	if(query.patientEmail){
		andConditions.push({
			patient : {
				email : query.patientEmail
			}
		})
	}

	const appointments = await prisma.appointment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder },
		include: {
			patient: { select: { id: true, name: true, email: true } },
			doctor: { select: { id: true, name: true, specialization: true } },
			schedule: true,
			payment: true,
		},
	});

	const total = await prisma.appointment.count({
		where: { AND: andConditions },
	});

	return {
		data: appointments,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};


}
// for all loggedin user
const getSingleAppointment = async (
	appointmentId: string,
	user: RequestUser,
) => {
	const appointment = await prisma.appointment.findUnique({
		where: {
			id: appointmentId,
		},

		include: {
			doctor: {
				select: {
					id: true,
					name: true,
					email: true,
					userId: true,
				},
			},
			patient: {
				select: {
					id: true,
					name: true,
					specialization: true,
					userId: true,
				},
			},
			schedule: true,
			payment: true,
		},
	});

	if (!appointment) {
		throw new AppError(httpStatus.NOT_FOUND, "Application Not Found");
	}

	if (user.role === Role.PATIENT) {
		if (appointment.patient.userId !== user.userId) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"You Are Not Allowed To View This Appointment",
			);
		}
	}
	if (user.role === Role.PATIENT) {
		if (appointment.doctor.userId !== user.userId) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"You Are Not Allowed To View This Appointment",
			);
		}
	}
return appointment

};

export const AppointmentServices = {
	bookAppointment,
	bookAppointmentCallback,
	payAppointment,
	cancelAppointment,
	updateAppointmentStatus,
	getAllAppointments,
	getSingleAppointment,
	getDoctoreAppointment,
	getmyAppointment
};
