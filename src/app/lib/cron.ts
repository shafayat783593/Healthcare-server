import cron from "node-cron";
import { prisma } from "./prisma";
import {
	DoctorCertificationStatus,
	Role,
} from "../../generated/prisma/enums";

export const deleteUnverifiedAndRejectedDoctors = async () => {
	// Every 10 minutes
	cron.schedule("*/10 * * * *", async () => {
		try {
			// ============================================
			// 1. Unverified email doctor => delete after 1 hour
			// ============================================

			const oneHourAgo = new Date(
				Date.now() - 60 * 60 * 1000,
			);

			const deletedUnverifiedDoctors =
				await prisma.user.deleteMany({
					where: {
						role: Role.DOCTOR,
						emailVerified: false,
						createdAt: {
							lt: oneHourAgo,
						},
						doctor: {
							verificationStatus:
								DoctorCertificationStatus.PENDING,
						},
					},
				});

			if (deletedUnverifiedDoctors.count > 0) {
				console.log(
					`Cron: Deleted ${deletedUnverifiedDoctors.count} unverified doctor(s) older than 1 hour`,
				);
			}

			// ============================================
			// 2. Rejected doctor => delete after 1 month
			// ============================================

			const oneMonthAgo = new Date();

			oneMonthAgo.setMonth(
				oneMonthAgo.getMonth() - 1,
			);

			const deletedRejectedDoctors =
				await prisma.user.deleteMany({
					where: {
						role: Role.DOCTOR,

						doctor: {
							verificationStatus:
								DoctorCertificationStatus.REJECTED,

							rejectedAt: {
								lt: oneMonthAgo,
							},
						},
					},
				});

			if (deletedRejectedDoctors.count > 0) {
				console.log(
					`Cron: Deleted ${deletedRejectedDoctors.count} rejected doctor(s) older than 1 month`,
				);
			}
		} catch (error) {
			console.error(
				"Cron: Failed to delete doctor applications:",
				error,
			);
		}
	});

	console.log(
		"Doctor cleanup cron scheduled (every 10 minutes)",
	);
};