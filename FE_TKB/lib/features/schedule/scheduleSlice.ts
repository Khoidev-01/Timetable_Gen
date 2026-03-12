import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Matches Backend Interface
export interface ScheduleSlot {
    id: string;
    classId: string;
    subjectId: string;
    teacherId: string | null;
    teacherName?: string;
    roomId?: string;
    roomName?: string;
    day: number; // 2-7
    period: number; // 1-5 (Morning), 6-10 (Afternoon)
    isLocked?: boolean;
}

interface ScheduleState {
    data: ScheduleSlot[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: ScheduleState = {
    data: [],
    status: 'idle',
    error: null,
};

export const scheduleSlice = createSlice({
    name: 'schedule',
    initialState,
    reducers: {
        setSchedule: (state, action: PayloadAction<ScheduleSlot[]>) => {
            state.data = action.payload;
        },
        moveLesson: (state, action: PayloadAction<{ id: string; day: number; period: number }>) => {
            const { id, day, period } = action.payload;
            const lesson = state.data.find((s) => s.id === id);
            if (lesson) {
                lesson.day = day;
                lesson.period = period;
            }
        },
    },
});

export const { setSchedule, moveLesson } = scheduleSlice.actions;

export default scheduleSlice.reducer;
