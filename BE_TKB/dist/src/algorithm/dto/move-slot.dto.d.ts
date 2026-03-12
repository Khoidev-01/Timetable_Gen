export declare class MoveSlotDto {
    semesterId: string;
    classId: string;
    from: {
        day: number;
        period: number;
        session: number;
    };
    to: {
        day: number;
        period: number;
        session: number;
    };
}
