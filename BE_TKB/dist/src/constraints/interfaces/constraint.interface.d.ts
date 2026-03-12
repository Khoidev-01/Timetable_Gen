export interface Violation {
    type: 'HARD' | 'SOFT';
    constraintName: string;
    description: string;
    penaltyScore: number;
}
export interface Constraint {
    name: string;
    priority: 'HARD' | 'SOFT';
    weight: number;
    check(schedule: any): Violation | null;
}
export declare enum HardConstraintType {
    HC_01_NO_TEACHER_CONFLICT = "HC_01_NO_TEACHER_CONFLICT",
    HC_02_NO_CLASS_CONFLICT = "HC_02_NO_CLASS_CONFLICT",
    HC_03_NO_ROOM_CONFLICT = "HC_03_NO_ROOM_CONFLICT",
    HC_04_CORRECT_ASSIGNMENT = "HC_04_CORRECT_ASSIGNMENT",
    HC_05_PERIOD_LIMIT = "HC_05_PERIOD_LIMIT",
    HC_06_TIME_SLOT_VALIDITY = "HC_06_TIME_SLOT_VALIDITY",
    HC_07_ROOM_SUITABILITY = "HC_07_ROOM_SUITABILITY",
    HC_08_DAILY_LIMIT_CLASS = "HC_08_DAILY_LIMIT_CLASS",
    HC_09_DAILY_LIMIT_TEACHER = "HC_09_DAILY_LIMIT_TEACHER"
}
export declare enum SoftConstraintType {
    SC_01_SPREAD_SUBJECTS = "SC_01_SPREAD_SUBJECTS",
    SC_02_AVOID_HEAVY_TOPICS = "SC_02_AVOID_HEAVY_TOPICS",
    SC_03_MINIMIZE_IDLE_TEACHER = "SC_03_MINIMIZE_IDLE_TEACHER",
    SC_04_MINIMIZE_IDLE_CLASS = "SC_04_MINIMIZE_IDLE_CLASS",
    SC_05_TEACHER_PREFERENCE = "SC_05_TEACHER_PREFERENCE",
    SC_06_BALANCE_LOAD = "SC_06_BALANCE_LOAD",
    SC_07_MAIN_SUBJECT_MORNING = "SC_07_MAIN_SUBJECT_MORNING",
    SC_08_STABILITY = "SC_08_STABILITY"
}
export interface ScheduleSlot {
    id: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    roomId?: string;
    day: number;
    period: number;
    isFixed?: boolean;
    isLocked?: boolean;
}
