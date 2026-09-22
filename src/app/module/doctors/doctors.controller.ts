import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { doctorService } from "./doctors.service";

const applyDoctors = catchAsync(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const resume = files?.["resume"] ? files["resume"][0] : null;

    // FIXED TYPO: "additionlaFiles" -> "additionalFiles"
    const additionalFiles = files?.["additionalFiles"] || [];
    const data = req.body.data;

    const result = await doctorService.applyDoctors(
        data,
        resume,
        additionalFiles,
    );
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Application created successfully",
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
        message: "Doctor Approved Successfully", // FIXED MESSAGE
        data: result,
    });
});

const getAllDoctor = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await doctorService.getAllDoctor(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctors retrieved successfully",
        data: data,
        meta: meta,
    });
});

const getAvailableDoctorByTodaysSchedule = catchAsync(
    async (req: Request, res: Response) => {
        const { data, meta } = await doctorService.getAvailableDoctorByTodaysSchedule(
            req.query
        );
        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Today's Available Doctors Retrieved Successfully",
            data,
            meta,
        });
    },
);

const getAllDoctorsListPublic = catchAsync(async (req: Request, res: Response) => {
    const { data, meta } = await doctorService.getAllDoctorsListPublic(
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctors Retrieved Successfully",
        data,
        meta,
    });
});

const getSingleDoctorPublicProfile = catchAsync(
    async (req: Request, res: Response) => {
        const doctorId = req.params.doctorId as string;
        
        const result = await doctorService.getSingleDoctorPublicProfile(
            doctorId
        );
        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Doctor Profile Retrieved Successfully",
            data: result,
        });
    },
);

const updateDoctorProfile = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;
        const user = req.user!;

        const result = await doctorService.updateDoctorProfile(payload, user);
        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Doctor Profile Updated Successfully",
            data: result,
        });
    },
);

export const doctorController = {
    applyDoctors,
    verifyDoctorEmail,
    approveDoctor,
    getAllDoctor,
    getAvailableDoctorByTodaysSchedule,
    getAllDoctorsListPublic,
    getSingleDoctorPublicProfile,
    updateDoctorProfile,
};