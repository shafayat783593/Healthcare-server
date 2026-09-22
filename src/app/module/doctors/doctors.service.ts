import { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import { omit } from "zod/mini";
import { tr } from "zod/locales";
import {
	DoctorCertificationStatus,
	Role,
	ScheduleStatus,
} from "../../../generated/prisma/enums";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { redisClient } from "../../lib/redis";
import {
	
	IApproveDoctorPayload,
	IUpdateDoctorProfilePayload,
	IVerifyDoctorEmailPayload,
} from "./doctors.interface";
import { RequestUser } from "../../middleware/checkAuth";
import path from "node:path";
import ejs from "ejs";
import { transporter } from "../../lib/nodmailer";
import config from "../../config";
import { IQuary } from "../../interface";
import { DoctorWhereInput } from "../../../generated/prisma/models";
import { catchAsync } from "../../utils/catchAsync";
import { addDays, startOfDay } from "date-fns";
import { randomInt } from 'node:crypto';
import generateRandomPassword from "../../utils/randomPassword";
import bcrypt from "bcryptjs";

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

	// 2. Check if user already exists
	const isUserExists = await prisma.user.findUnique({
		where: { email: userEmail },
	});

	if (isUserExists) {
		throw new Error("User already exists with this email");
	}

	// 3. Cloudinary Upload Helper
	const uploadToCloudinary = (
		file: Express.Multer.File,
	): Promise<UploadApiResponse> => {
		return new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{ resource_type: "auto" },
				(error, result) => {
					if (error) {
						return reject(new Error(error.message));
					}

					if (!result) {
						return reject(
							new Error("No result returned from Cloudinary"),
						);
					}

					resolve(result);
				},
			);

			uploadStream.end(file.buffer);
		});
	};

	// 4. Upload Resume
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

					// Doctor data comes from parsedPayload.doctor
					...parsedPayload.doctor,

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


	const expirationSeconds = 60 * 60;

const otpValue = randomInt(100000, 1000000).toString();
const otpKey = `doctor-application-otp:${parsedPayload.user.email}`;

if (config.node_env === "development") {
    console.log(
        `[dev] Doctor application OTP for ${parsedPayload.user.email}: ${otpValue}`,
    );
}

await redisClient.set(otpKey, otpValue, {
    expiration: {
        type: "EX",
        value: expirationSeconds,
    },
});

const tempatePath = path.join(
    process.cwd(),
    "src/app/templates/registration-user-otp.ejs",
);

// ✅ CORRECT
const templateData = {
    name: parsedPayload.user.name,
    email: parsedPayload.user.email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
};

const html = await ejs.renderFile(tempatePath, templateData);

// ✅ CORRECT
await transporter.sendMail({
    from: config.email_sender,
    to: parsedPayload.user.email,
    subject: "Doctor Application - Email Verification",
    html,
});
	return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	console.log(otp,email)
	const existingUser = await prisma.user.findUnique({
		where: { email},
	});
	console.log("exixti user..",existingUser)


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


const approveDoctor = async (
  payload: IApproveDoctorPayload,
  reviewer: RequestUser,
) => {
  const { doctorId, verificationStatus, rejectionReason } = payload;

  const existingDoctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!existingDoctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor Application Not Found");
  }

  if (existingDoctor.isDeleted) {
    throw new AppError(httpStatus.GONE, "Doctor Application Has Been Deleted");
  }

  if (!existingDoctor.user.emailVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Doctor Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
    );
  }

  if (existingDoctor.verificationStatus !== DoctorCertificationStatus.PENDING) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Doctor Application Has Already Been ${existingDoctor.verificationStatus.toLowerCase()}`,
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

  const isApproved = verificationStatus === DoctorCertificationStatus.APPROVED;

  const randomDoctorPassword = isApproved
    ? generateRandomPassword()
    : undefined;

  if (config.node_env === "development" && randomDoctorPassword) {
    console.log(`[dev] Random Password plain text: ${randomDoctorPassword}`);
  }

  const hashedPassword = randomDoctorPassword
    ? await bcrypt.hash(randomDoctorPassword, Number(config.bcrypt_salt_rounds))
    : undefined;

  const updatedDoctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus,
      rejectionReason:
        verificationStatus === DoctorCertificationStatus.REJECTED
          ? rejectionReason
          : null,
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
      ...(hashedPassword
        ? { user: { update: { password: hashedPassword } } }
        : {}),
    },
  });

  const tempatePath = path.join(
    process.cwd(),
    `src/app/templates/${
      isApproved
        ? "doctor-application-approved.ejs"
        : "doctor-application-rejected.ejs"
    }`,
  );

  const templateData = {
    name: updatedDoctor.name,
    reason: updatedDoctor.rejectionReason,
    password: isApproved ? randomDoctorPassword : undefined,
  };

  const html = await ejs.renderFile(tempatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: updatedDoctor.email,
    subject: isApproved
      ? "Your Doctor Application Has Been Approved"
      : "Your Doctor Application Has Been Rejected",
    html,
  });

  return updatedDoctor;
};

const getAllDoctor = async (query: IQuary) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: DoctorWhereInput[] = [];
	// searching........
	if (query.searchTerm) {
		andConditions.push({
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
		});
	}

	// filtering...........
	if (query.specialization) {
		andConditions.push({
			specialization: { equals: query.specialization, mode: "insensitive" },
		});
	}

	if (query.email) {
		andConditions.push({
			email: { contains: query.email, mode: "insensitive" },
		});
	}

	if (query.licenseNumber) {
		andConditions.push({
			licenseNumber: { equals: query.licenseNumber, mode: "insensitive" },
		});
	}

	



	if (query.verificationStatus) {
  andConditions.push({
    verificationStatus:
      query.verificationStatus as DoctorCertificationStatus,
  });
}
	// if(query.isDeleted){
	//     andConditions.push({
	//         isDeleted:query.isDeleted === "true" ? true :false

	//     })
	// }

	andConditions.push({ isDeleted: false });

	const allDoctors = await prisma.doctor.findMany({
		where: {
			AND: andConditions.length > 0 ? andConditions : undefined,
		},
		take: limit,
		skip: skip,
		orderBy: {
			[sortBy]: sortOrder,
		},
		include: {
			user: {
				omit: {
					password: true,
				},
			},
		},
	});

	const totalDoctorCount = await prisma.doctor.count({
		where: {
			AND: andConditions,
		},
	});
	return {
		data: allDoctors,
		meta: {
			page: page,
			limit: limit,
			total: totalDoctorCount,
			totalPages: Math.ceil(totalDoctorCount / limit),
		},
	};
}





const updateDoctorProfile = async (
  payload: IUpdateDoctorProfilePayload,
  user: RequestUser,
) => {
  const existingDoctor = await prisma.doctor.findUnique({
    where: { userId: user.userId },
  });

  if (!existingDoctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: existingDoctor.id },
    data: payload,
  });

  return updatedDoctor;
};

// Fields safe to expose on the public (unauthenticated) doctor-discovery endpoints.
// Deliberately excludes resume/additionalFiles, verification review metadata, and
// anything relation/auth related (user, userId, isDeleted, deletedAt...).

const getAvailableDoctorByTodaysSchedule = async (query: IQuary) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfTomorrow = addDays(startOfToday, 1);

  // A doctor is "available today" if they have at least one published,
  // not-yet-started schedule today with open slots left.

  const andConditions: DoctorWhereInput[] = [
    { isDeleted: false },
    { verificationStatus: DoctorCertificationStatus.APPROVED },
    {
      schedules: {
        some: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          availableSlots: { gt: 0 },
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        },
      },
    },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { specialization: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.specialization) {
    andConditions.push({
      specialization: { equals: query.specialization, mode: "insensitive" },
    });
  }

  const availableDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
      schedules: {
        where: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          availableSlots: { gt: 0 },
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        },
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          startDateTime: true,
          endDateTime: true,
          availableSlots: true,
          totalSlots: true,
        },
      },
    },
  });

  const totalAvailableDoctorCount = await prisma.doctor.count({
    where: { AND: andConditions },
  });

  return {
    data: availableDoctors,
    meta: {
      page,
      limit,
      total: totalAvailableDoctorCount,
      totalPages: Math.ceil(totalAvailableDoctorCount / limit),
    },
  };
};

const getAllDoctorsListPublic = async (query: IQuary) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: DoctorWhereInput[] = [
    { isDeleted: false },
    { verificationStatus: DoctorCertificationStatus.APPROVED },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { specialization: { contains: query.searchTerm, mode: "insensitive" } },
        { qualifications: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.specialization) {
    andConditions.push({
      specialization: { equals: query.specialization, mode: "insensitive" },
    });
  }

  const allDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
    },
  });

  const totalDoctorCount = await prisma.doctor.count({
    where: { AND: andConditions },
  });

  return {
    data: allDoctors,
    meta: {
      page,
      limit,
      total: totalDoctorCount,
      totalPages: Math.ceil(totalDoctorCount / limit),
    },
  };
};

const getSingleDoctorPublicProfile = async (doctorId: string) => {
  const doctor = await prisma.doctor.findUnique({
    where: {
      id: doctorId,
      isDeleted: false,
      verificationStatus: DoctorVerificationStatus.APPROVED,
    },
    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
    },
  });

  if (!doctor) {
    throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found");
  }

  return doctor;
};


export const doctorService = {
	applyDoctors,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctor,
	updateDoctorProfile,
	getAvailableDoctorByTodaysSchedule,
	getAllDoctorsListPublic,
	getSingleDoctorPublicProfile
};
