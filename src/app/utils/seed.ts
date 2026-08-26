import { email } from "zod"
import { Role } from "../../generated/prisma/enums"
import { prisma } from "../lib/prisma"
import bcrypt from "bcryptjs"
import config from "../config"


export const seedSuperAdmin = async()=>{
    try {
     const isSuperAdminExist = await prisma.user.findFirst({
        where:{
            role:Role.SUPER_ADMIN
        }
     }) 
     if(isSuperAdminExist){
         console.log("super admin already exists")
         return;

     } 
     const name=config.super_admin_name 
     const password =config.super_admin_password
     const email  =config.super_admin_email
    if (!name || !email || !password) {
    throw new Error("Super Admin Name, Email, Password missing in ENV file");
}
     const hashPassword = await bcrypt.hash(password,Number(config.bcrypt_salt_rounds))
     const superAdmin = await prisma.user.create({
        data:{
            name,
            email,
            password:hashPassword,
            role:Role.SUPER_ADMIN,
            emailVerified:true,
            needPasswordChange:false,
        }
     })
     console.log("super admin created",superAdmin)


    } catch (error) {
        console.log("Error seeding super Admin :",error)
        await prisma.user.delete({
            where:{
                email:config.super_admin_email
            }
        })
    }
}



//create tester admin

export const seedTesterAdmin = async () => {
	try {
		const isTesterAdminExist = await prisma.user.findUnique({
			where: {
				email: config.tester_admin_email,
			},
		});

		if (isTesterAdminExist) {
			console.log("Tester Admin Already Exists!");
			return;
		}

		const name = config.tester_admin_name;
		const email = config.tester_admin_email;
		const password = config.tester_admin_password;

		if (!name || !email || !password) {
			throw new Error(
				"Tester Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Tester Admin Created : ", testerAdmin);
	} catch (error) {
		console.log("Error Seeding Tester Admin : ", error);

		await prisma.user.delete({
			where: {
				email: config.tester_admin_email,
			},
		});
	}
};

// create tester doctor

export const seedTesterDoctor = async () => {
	try {
		const isTesterDoctorExist = await prisma.user.findUnique({
			where: {
				email: config.tester_doctor_email,
			},
		});

		if (isTesterDoctorExist) {
			console.log("Tester Doctor Already Exists!");
			return;
		}

		const name = config.tester_doctor_name;
		const email = config.tester_doctor_email;
		const password = config.tester_admin_password;

		if (!name || !email || !password) {
			throw new Error(
				"Tester Doctor Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerDoctor = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.DOCTOR,
				needPasswordChange: false,
				emailVerified: true,
				doctor: {
					create: {
						email,
						name,
						experienceYears: 5,
						licenseNumber: "BMDC0000",
						qualifications: "MBBS",
						specialization: "Neurology",
					},
				},
			},
		});

		console.log("Tester Doctor Created : ", testerDoctor);
	} catch (error) {
		console.log("Error Seeding Tester Doctor : ", error);

		await prisma.user.delete({
			where: {
				email: config.tester_doctor_email,
			},
		});
	}
};