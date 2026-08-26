import z, { email } from "zod";

const patientRegistrationZodSchema = z.object({
	name: z
		.string("Not A String")
		.min(3, "Name must at last 3 chracter long")
		.max(100),
	email: z.string().email(),
	password: z
		.string()
		.min(8, "Password must Minimum 8 Charcters Long")
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
		.regex(/[a-z]/, "Password must contain atleast 1 LowerCase letter")
		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
	patient: z.object({
		contactNumber: z.string().min(10).max(15),
	}).optional()
});
const patientVerifyZodSchema = z.object({

	email: z.string().email(),
			otp:z.string().length(6)

});

 const laginzod =z.object({
	email: z.string().email(),
	password: z
		.string()
		.min(8, "Password must Minimum 8 Charcters Long")
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
		.regex(/[a-z]/, "Password must contain atleast 1 LowerCase letter")
		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),

})

const resetPasswordZodSchema = z.object({
	email: z.string().email(),
	newPassword: z
		.string()
		.min(8, "Password must Minimum 8 Charcters Long")
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
		.regex(/[a-z]/, "Password must contain atleast 1 LowerCase letter")
		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
		otp:z.string().length(6)

})
const ForgotPasswordZodSchema = z.object({
	email: z.string().email(),

})





export const Patinvalidation = {
	patientRegistrationZodSchema,
	laginzod,
	resetPasswordZodSchema,
	ForgotPasswordZodSchema,
	patientVerifyZodSchema
};

