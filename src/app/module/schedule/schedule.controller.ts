import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { scheduleService } from "./schedule.service";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";


const createSchedule  = catchAsync(async(req:Request,res:Response)=>{


    const payload = req.body
    const user  = req.user!
    const result = await scheduleService.createShedule(payload,user)
    	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor Schedule successfully",
		data: result,
		
	});
})

export const scheduleController = {
    createSchedule
}