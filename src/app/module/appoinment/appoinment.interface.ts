import { AppointmentStatus } from "../../../generated/prisma/enums";







export interface IBookingAppointmentPayload {
	scheduledId: string;
}

export interface IPayAppointmentPayload {
	appointmentId: string;
}
export interface ICancleAppointmentPayload {
	appointmentId: string;
}


export interface IUpdateAppointmentStatusPayload {
status:"ONGOING"| "COMPLETED"

}