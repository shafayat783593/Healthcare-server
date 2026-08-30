

export interface IcreateSchedulePayload{
    startDate:Date;
    endDate:Date;
    mettingLink:string

}


export interface IupdateSchedulePayload{
    startDate?:Date;
    endDate?:Date;
    mettingLink?:string

}


