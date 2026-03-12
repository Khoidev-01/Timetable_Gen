export class MoveSlotDto {
    semesterId: string;
    classId: string;
    from: {
        day: number;
        period: number;
        session: number; // 0 or 1
    };
    to: {
        day: number;
        period: number;
        session: number; // 0 or 1
    };
}
