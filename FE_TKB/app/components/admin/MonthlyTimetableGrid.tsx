'use client';
import { useMemo, useState } from 'react';

interface ScheduleSlot {
    id: string;
    classId: string;
    class?: { name: string };
    className?: string;
    subjectId: string;
    subject?: { name: string; code: string; color?: string };
    subjectName?: string;
    teacherId?: string;
    teacher?: { full_name: string; code: string; short_name?: string };
    teacherName?: string;
    roomId?: string;
    room?: { name: string };
    roomName?: string;
    day: number;
    period: number;
    session: number;
    is_locked?: boolean;
}

interface MonthlyTimetableGridProps {
    schedule: ScheduleSlot[];
    viewMode: 'CLASS' | 'TEACHER';
    selectedEntityId: string;
}

const hexToRgba = (hex: string | undefined, alpha: number) => {
    if (!hex) return 'rgba(235, 248, 255, 0.5)';
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
};

export default function MonthlyTimetableGrid({ schedule, viewMode, selectedEntityId }: MonthlyTimetableGridProps) {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Filter slots for the selected entity
    const filteredSlots = useMemo(() => {
        return schedule.filter(slot => {
            if (viewMode === 'CLASS') return slot.classId === selectedEntityId;
            if (viewMode === 'TEACHER') return slot.teacherId === selectedEntityId;
            return false;
        });
    }, [schedule, viewMode, selectedEntityId]);

    // Group by Day (2-7)
    const slotMapByDay = useMemo(() => {
        const map = new Map<number, ScheduleSlot[]>();
        for (let d = 2; d <= 7; d++) {
            map.set(d, []);
        }
        filteredSlots.forEach(slot => {
            const slotsOfDay = map.get(slot.day) || [];
            slotsOfDay.push(slot);
            map.set(slot.day, slotsOfDay);
        });

        // Sort each day by period
        for (const [day, slots] of map.entries()) {
            slots.sort((a, b) => {
                const aLookup = a.session === 1 ? a.period + 5 : a.period;
                const bLookup = b.session === 1 ? b.period + 5 : b.period;
                return aLookup - bLookup;
            });
        }
        return map;
    }, [filteredSlots]);

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const generateCalendarGrid = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        
        // getDay() returns 0 for Sunday, 1 for Monday
        // We want Monday (1) to be the first column, Sunday (0) to be the 7th.
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const startingColIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        const weeks: any[][] = [];
        let currentWeek: any[] = Array(7).fill(null);
        let currentDay = 1;

        for (let i = 0; i < startingColIndex; i++) {
            currentWeek[i] = null;
        }

        while (currentDay <= daysInMonth) {
            const dayOfWeek = new Date(year, month, currentDay).getDay();
            const colIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            
            currentWeek[colIndex] = {
                date: currentDay,
                jsDayOfWeek: dayOfWeek // 0: Sun, 1: Mon, ... 6: Sat
            };

            if (colIndex === 6 || currentDay === daysInMonth) {
                weeks.push(currentWeek);
                currentWeek = Array(7).fill(null);
            }
            currentDay++;
        }

        return weeks;
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const weeks = generateCalendarGrid();

    return (
        <div className="bg-[var(--bg-surface)] rounded-lg shadow-sm overflow-hidden border border-[var(--border-default)] select-none flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-[var(--border-default)] bg-[var(--bg-surface-hover)]">
                <button onClick={prevMonth} className="px-3 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] hover:bg-gray-100 dark:hover:bg-gray-800">
                    &lt; Tháng trước
                </button>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Tháng {currentDate.getMonth() + 1} - Năm {currentDate.getFullYear()}
                </h2>
                <button onClick={nextMonth} className="px-3 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] hover:bg-gray-100 dark:hover:bg-gray-800">
                    Tháng sau &gt;
                </button>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto p-4">
                <table className="w-full table-fixed border-collapse">
                    <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] text-sm font-bold">
                        <tr>
                            <th className="p-2 border border-[var(--border-default)]">Thứ 2</th>
                            <th className="p-2 border border-[var(--border-default)]">Thứ 3</th>
                            <th className="p-2 border border-[var(--border-default)]">Thứ 4</th>
                            <th className="p-2 border border-[var(--border-default)]">Thứ 5</th>
                            <th className="p-2 border border-[var(--border-default)]">Thứ 6</th>
                            <th className="p-2 border border-[var(--border-default)]">Thứ 7</th>
                            <th className="p-2 border border-[var(--border-default)] text-red-500">CN</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeks.map((week, wIndex) => (
                            <tr key={wIndex}>
                                {week.map((dayObj, dIndex) => {
                                    if (!dayObj) return <td key={dIndex} className="border border-[var(--border-default)] bg-gray-50/50 dark:bg-gray-900/20 p-2 min-h-[120px]"></td>;
                                    
                                    // Map jsDayOfWeek (1-6) to DB Day (2-7)
                                    // JS: 1(Mon) -> DB: 2
                                    // JS: 0(Sun) -> no DB equivalent for classes
                                    let dbDay = dayObj.jsDayOfWeek === 0 ? 0 : dayObj.jsDayOfWeek + 1;
                                    const daySlots = dbDay !== 0 ? slotMapByDay.get(dbDay) || [] : [];
                                    
                                    const isToday = new Date().getDate() === dayObj.date && 
                                                    new Date().getMonth() === currentDate.getMonth() && 
                                                    new Date().getFullYear() === currentDate.getFullYear();

                                    return (
                                        <td key={dIndex} className="border border-[var(--border-default)] p-1 align-top h-32 w-[14.28%]">
                                            <div className={`text-right text-xs font-bold p-1 ${isToday ? 'text-blue-600 bg-blue-50 rounded-full w-6 h-6 flex items-center justify-center ml-auto' : 'text-gray-500'}`}>
                                                {dayObj.date}
                                            </div>
                                            <div className="mt-1 flex flex-col gap-1 h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                                                {daySlots.map(slot => {
                                                    const rawColor = slot.subject?.color;
                                                    const bgColor = hexToRgba(rawColor, 0.25);
                                                    const borderColor = hexToRgba(rawColor, 0.8) || '#cbd5e1';
                                                    
                                                    return (
                                                        <div key={slot.id} 
                                                             className="text-[10px] p-1 rounded border-l-2 leading-tight flex justify-between items-center group relative cursor-help"
                                                             style={{ backgroundColor: bgColor, borderLeftColor: borderColor }}
                                                             title={`Tiết ${slot.session === 0 ? slot.period : slot.period + 5} - ${slot.subject?.name || slot.subjectName || slot.subjectId}\n${viewMode === 'CLASS' ? (slot.teacher?.full_name || slot.teacherName) : (slot.class?.name || slot.className)}`}
                                                        >
                                                            <span className="font-semibold truncate uppercase text-[var(--text-primary)] w-3/5">
                                                                T{slot.session === 0 ? slot.period : slot.period + 5}: {slot.subject?.code || slot.subject?.name || slot.subjectName || slot.subjectId}
                                                            </span>
                                                            <span className="truncate text-gray-500 text-[9px] w-2/5 text-right">
                                                                {viewMode === 'CLASS' ? (slot.teacher?.short_name || slot.teacher?.full_name || slot.teacherName) : (slot.class?.name || slot.className)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                {daySlots.length === 0 && dayObj.jsDayOfWeek !== 0 && (
                                                    <div className="text-[10px] text-gray-400 text-center mt-4">Trống lịch</div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
