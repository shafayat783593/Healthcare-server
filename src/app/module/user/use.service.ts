import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
    const currentUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            imagePublicId: true,
        },
    });

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `profiles/${userId}`,
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    return reject(new Error(error.message));
                }

                if (!result) {
                    return reject(new Error("No result returned from Cloudinary"));
                }

                resolve(result);
            }
        );

        uploadStream.end(buffer);
    });

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            imageUrl: result.secure_url,
            imagePublicId: result.public_id,
        },
        omit: {
            password: true,
        },
    });

    // Delete old image after successful DB update
    if (currentUser?.imagePublicId) {
        try {
            await cloudinary.uploader.destroy(currentUser.imagePublicId);
        } catch (error) {
            console.error("Failed to delete old Cloudinary image:", error);
        }
    }

    return updatedUser;
};

export const Userservices = {
	uploadProfileImage,
};