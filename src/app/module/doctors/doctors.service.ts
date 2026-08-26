import { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import { omit } from "zod/mini";
import { tr } from "zod/locales";
import {
	DoctorCertificationStatus,
	Role,
} from "../../../generated/prisma/enums";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { redisClient } from "../../lib/redis";
import {
	IApprovedDoctorPayload,
	IVerifyDoctorEmailPayload,
} from "./doctors.interface";
import { RequestUser } from "../../middleware/checkAuth";

const applyDoctors = async (
	payload: any,
	resume: Express.Multer.File | null,
	additionalFiles: Express.Multer.File[] = [],
) => {
	// 1. Parse payload if it comes as a string (from FormData req.body.data)
	const parsedPayload =
		typeof payload === "string" ? JSON.parse(payload) : payload;

	const userEmail = parsedPayload?.user?.email;
	if (!userEmail) {
		throw new Error("User email is required in payload.user.email");
	}

	// 2. Fix existence check: Throw error if user ALREADY exists
	const isUserExists = await prisma.user.findUnique({
		where: { email: userEmail },
	});

	if (isUserExists) {
		throw new Error("User already exists with this email");
	}

	// 3. Cloudinary Upload Helper for Buffer Streams
	const uploadToCloudinary = (
		file: Express.Multer.File,
	): Promise<UploadApiResponse> => {
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{ resource_type: "auto" },
				(error, result) => {
					if (error) return reject(new Error(error.message));
					if (!result)
						return reject(new Error("No result returned from Cloudinary"));
					resolve(result);
				},
			);
			uploadStream.end(file.buffer); // Called ONCE per file
		});
	};

	// 4. Upload Resume conditionally
	let resumeUploadResult: UploadApiResponse | null = null;
	if (resume?.buffer) {
		resumeUploadResult = await uploadToCloudinary(resume);
	}

	// 5. Upload Additional Files
	const additionalFilesUploadResult = await Promise.all(
		additionalFiles.map((file) => uploadToCloudinary(file)),
	);

	// 6. Create User & Nested Doctor Record
	const doctorApplication = await prisma.user.create({
		data: {
			...parsedPayload.user,
			doctor: {
				create: {
					name: parsedPayload.user.name,
					email: parsedPayload.user.email,
					...parsedPayload.payload,
					resumePublicId: resumeUploadResult?.public_id || null,
					resume: resumeUploadResult?.secure_url || null,
					additionalFiles: additionalFilesUploadResult.map((file) => ({
						url: file.secure_url,
						publicId: file.public_id,
					})),
				},
			},
		},
		omit: {
			password: true,
		},

		include: {
			doctor: true,
		},
	});

	return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({
		where: { email, role: Role.DOCTOR },
	});

	if (!existingUser) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Doctor Application Not Found. Please Apply Again.",
		);
	}

	if (existingUser.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "Email Already Verified");
	}

	const otpKey = `doctor-application-otp:${email}`;

	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP Expired. Your Application Window Has Closed, Please Apply Again.",
		);
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
	}

	await redisClient.del(otpKey);

	const verifiedUser = await prisma.user.update({
		where: { id: existingUser.id },
		data: { emailVerified: true },
		omit: { password: true },
		include: { doctor: true },
	});

	return verifiedUser;
};

const approveDoctor = async (payload: IApprovedDoctorPayload, reviewer:RequestUser) => {
	const { doctorId, verificationStatus, rejectionReason } = payload;

	const existingDoctor = await prisma.doctor.findUnique({
		where: {
			id: doctorId,
		},
		include: {
			user: true,
		},
	});
	if (!existingDoctor) {
		throw new Error("Doctor Application Not Found");
	}
	if (existingDoctor.isDeleted) {
		throw new Error("Doctor Application Has Been Deleted");
	}
	if (!existingDoctor.user.emailVerified) {
		throw new Error(
			"Doctor Has Not Verified Thir Email Yet.Application Cannot be Reviewed",
		);
	}
	if (existingDoctor.verificationStatus !== DoctorCertificationStatus.PENDING) {
		throw new Error(
			`Doctor Application Has Already Been ${existingDoctor.verificationStatus.toLocaleLowerCase()}`,
		);
	}
	if (
		verificationStatus === DoctorCertificationStatus.REJECTED &&
		!rejectionReason
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Rejection Reason Is Required When Rejecting A Doctor Application",
		);
	}

    const updateDoctor = await prisma.doctor.update({
        where:{
            id:doctorId
        },
        data:{
            verificationStatus,
            rejectionReason:verificationStatus === DoctorCertificationStatus.REJECTED? rejectionReason:null,
            reviewedBy:reviewer.userId,
            reviewedAt:new Date()
        }
    })


};

export const doctorService = {
	applyDoctors,
	verifyDoctorEmail,
	approveDoctor,
};
