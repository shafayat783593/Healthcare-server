import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { doctorService } from "./doctors.service";
import { IApprovedDoctorPayload } from "./doctors.interface";

const applyDoctors = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as { [fieldname: string]: Express.Multer.File[] };
	const resume = files?.["resume"] ? files["resume"][0] : null;

	const additionalFiles = files?.["additionlaFiles"] || [];
	const data = req.body.data;

	console.log({ resume, additionalFiles, data });

	const result = await doctorService.applyDoctors(
		data,
		resume,
		additionalFiles,
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Appliction create successfully",
		data: result,
	});
});

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await doctorService.verifyDoctorEmail(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Email Verified Successfully",
		data: result,
	});
});
const approveDoctor = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await doctorService.approveDoctor(payload, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Email Verified Successfully",
		data: result,
	});
});
const getAllDoctor = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await doctorService.getAllDoctor(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Retived successfully",
		data: data,
		meta: meta,
	});
});

export const doctorController = {
	applyDoctors,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctor,
};
