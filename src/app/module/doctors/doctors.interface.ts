import { DoctorCertificationStatus } from "../../../generated/prisma/enums";




export interface IVerifyDoctorEmailPayload {
    email: string;
    otp: string;
}

export interface IApprovedDoctorPayload{
    doctorId:string;
    verificationStatus:DoctorCertificationStatus;
    rejectionReason:string;

}