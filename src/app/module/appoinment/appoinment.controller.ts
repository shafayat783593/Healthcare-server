import { catchAsync } from "../../utils/catchAsync";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { Request, Response } from "express";
import { AppointmentServices } from "./appoinment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
		const payload = req.body;
		const user = req.user!
	const result = await AppointmentServices.bookAppointment(payload,user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile upload successfully",
		data: result,
	});
});
const payAppointment = catchAsync(async (req: Request, res: Response) => {
		const payload = req.body;
		const user = req.user!
	const result = await AppointmentServices.payAppointment(payload,user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment Payment Initialted Successfully",
		data: result,
	});
});
const bookAppointmentCallback = catchAsync(async (req: Request, res: Response) => {
	const paymentID = req.query

		const { redirectUrl} =  await AppointmentServices.bookAppointmentCallback(paymentID);

        res.redirect(redirectUrl)
        console.log("callbacke controller", redirectUrl)
		// sendResponse(res, {
		// 	statusCode: httpStatus.OK,
		// 	success: true,
		// 	message: "Profile upload successfully",
		// 	data: result,
		// });
	},
);

const cancleAppointment = catchAsync(async (req: Request, res: Response) => {
		const payload = req.body;

	const result = await AppointmentServices.cancelAppointment(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment cancel Successfully",
		data: result,
	});
});

export const AppointmentController = {
	bookAppointment,
	bookAppointmentCallback,
	payAppointment,
	cancleAppointment
};
