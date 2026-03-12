import { configureStore } from '@reduxjs/toolkit';
import scheduleReducer from './features/schedule/scheduleSlice';

export const makeStore = () => {
    return configureStore({
        reducer: {
            schedule: scheduleReducer,
        },
    });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
