import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { Userservices } from "./use.service";
import { sendResponse } from "../../utils/sendResponse";

import httpStatus from "http-status"

const uploadProfileImage = catchAsync(async(req:Request,res:Response)=>{
console.log(req.file,"req file")
const file = req.file?.buffer
if(!file){
    throw new Error("No File Provied")
}
const userId = req.user?.userId
    const upload =  await Userservices.uploadProfileImage(file,userId as string)
    	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile upload successfully",
		data: upload
	});
})

export const userControllers={
    uploadProfileImage
}