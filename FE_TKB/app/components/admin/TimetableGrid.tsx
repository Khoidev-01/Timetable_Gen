'use client';
import { useMemo, useRef, useState } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent } from '@dnd-kit/core';

interface ScheduleSlot {
    id: string;
    classId: string;
    class?: { name: string };
    className?: string;
    subjectId: string;
    subject?: { name: string; code: string; color?: string };
    subjectName?: string;
    teacherId?: string;
    teacher?: { full_name: string; code: string };
    teacherName?: string;
    roomId?: string;
    room?: { name: string };
    roomName?: string;
    day: number;
    period: number;
    session: number;
    is_locked?: boolean;
}

interface TimetableGridProps {
    schedule: ScheduleSlot[];
    viewMode: 'CLASS' | 'TEACHER';
    selectedEntityId: string;
    onSlotMove?: (from: ScheduleSlot, to: { day: number, period: number, session: number }) => void;
    onToggleLock?: (slotId: string) => void;
    onConflictLog?: (msgs: string[]) => void;
    isEditable?: boolean;
}

const DAY_LABELS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'CN' };

function computeConflicts(
    dragging: ScheduleSlot,
    target: { day: number; period: number }, // period = actual 1-10
    schedule: ScheduleSlot[]
): string[] {
    if (dragging.day === target.day && dragging.period === target.period) return [];
    const conflicts: string[] = [];
    const dayLabel = DAY_LABELS[target.day] ?? `Thứ ${target.day}`;

    const classConflict = schedule.find(s =>
        s.id !== dragging.id &&
        s.classId === dragging.classId &&
        s.day === target.day &&
        s.period === target.period
    );
    if (classConflict) {
        const subjName = classConflict.subject?.name ?? classConflict.subjectName ?? classConflict.subjectId;
        const clsName = dragging.className ?? dragging.classId;
        conflicts.push(`Lớp ${clsName} đã có "${subjName}" tại ${dayLabel} tiết ${target.period}`);
    }

    if (dragging.teacherId) {
        const teacherConflict = schedule.find(s =>
            s.id !== dragging.id &&
            s.teacherId === dragging.teacherId &&
            s.day === target.day &&
            s.period === target.period
        );
        if (teacherConflict) {
            const tName = dragging.teacher?.full_name ?? dragging.teacherName ?? 'GV';
            const cName = teacherConflict.class?.name ?? teacherConflict.className ?? teacherConflict.classId;
            const sName = teacherConflict.subject?.name ?? teacherConflict.subjectName ?? '';
            conflicts.push(`GV ${tName} đang dạy "${sName}" tại lớp ${cName} vào ${dayLabel} tiết ${target.period}`);
        }
    }

    return conflicts;
}

const hexToRgba = (hex: string | undefined, alpha: number) => {
    if (!hex) return 'rgba(235, 248, 255, 0.5)';
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
};

const SlotContent = ({ slot, viewMode, isOverlay = false }: { slot: ScheduleSlot, viewMode: 'CLASS' | 'TEACHER', isOverlay?: boolean }) => {
    const rawColor = slot.subject?.color;
    const bgColor = hexToRgba(rawColor, 0.25);
    const borderColor = hexToRgba(rawColor, 0.8) ?? '#cbd5e1';

    return (
        <div
            className={`flex flex-col gap-0.5 items-center justify-center h-full w-full rounded-md p-1 border transition-all shadow-sm
            ${isOverlay ? 'scale-105 z-50 ring-2 ring-blue-400' : 'hover:brightness-95 hover:shadow-md'}`}
            style={{ backgroundColor: bgColor, borderColor, borderWidth: '1px', borderLeftWidth: '4px' }}
        >
            <span className="font-extrabold text-[var(--text-primary)] text-[13px] leading-tight text-center drop-shadow-sm uppercase tracking-wide">
                {slot.subject?.name ?? slot.subjectName ?? slot.subjectId}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)] font-semibold leading-tight text-center mt-0.5">
                {viewMode === 'CLASS'
                    ? (slot.teacher?.full_name ?? slot.teacherName ?? slot.teacherId)
                    : (slot.class?.name ?? slot.className ?? slot.classId)}
            </span>
            {(slot.room?.name ?? slot.roomName) && (
                <span className="text-[10px] bg-[var(--bg-surface)]/60 text-[var(--text-primary)] px-1.5 rounded-full border border-black/10 shadow-sm mt-0.5 font-mono">
                    {slot.room?.name ?? slot.roomName}
                </span>
            )}
        </div>
    );
};

const DraggableSlot = ({ slot, viewMode, isEditable, onToggleLock }: { slot: ScheduleSlot, viewMode: 'CLASS' | 'TEACHER', isEditable: boolean, onToggleLock?: (id: string) => void }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `drag-${slot.id}`,
        data: slot,
        disabled: !isEditable || !!slot.is_locked
    });

    return (
        <div ref={setNodeRef} className={`${isEditable && !slot.is_locked ? 'cursor-move' : 'cursor-default'} h-full w-full relative group ${isDragging ? 'opacity-30' : 'opacity-100'}`}>
            <div {...listeners} {...attributes} className="h-full w-full">
                <SlotContent slot={slot} viewMode={viewMode} />
            </div>
            {isEditable && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleLock?.(slot.id); }}
                    className={`absolute top-1 right-1 p-1 rounded-full shadow-sm transition-all z-10
                        ${slot.is_locked
                            ? 'bg-red-100 text-red-600 opacity-100'
                            : 'bg-[var(--bg-surface)] text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50'}`}
                    title={slot.is_locked ? 'Mở khóa' : 'Khóa'}
                >
                    {slot.is_locked ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                    )}
                </button>
            )}
        </div>
    );
};

const DroppableCell = ({ day, session, period, children, hasConflict }: {
    day: number; session: number; period: number;
    children: React.ReactNode;
    hasConflict: boolean; // only relevant when isOver === true
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `drop-${day}-${session}-${period}`,
        data: { day, session, period }
    });

    let cellClass = 'bg-[var(--bg-surface)]';
    if (isOver) {
        cellClass = hasConflict
            ? 'bg-red-50 ring-2 ring-inset ring-red-500'
            : 'bg-green-50 ring-2 ring-inset ring-green-500';
    }

    return (
        <td ref={setNodeRef} className={`p-1 border border-[var(--border-default)] text-center relative h-20 align-top transition-colors ${cellClass}`}>
            {children}
        </td>
    );
};

export default function TimetableGrid({ schedule, viewMode, selectedEntityId, onSlotMove, onToggleLock, onConflictLog, isEditable = true }: TimetableGridProps) {
    const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null);
    const [dragConflicts, setDragConflicts] = useState<string[]>([]);

    const activeSlotRef = useRef<ScheduleSlot | null>(null);
    const dragConflictsRef = useRef<string[]>([]);

    const filteredSlots = useMemo(() => {
        return schedule.filter(slot => {
            if (viewMode === 'CLASS') return slot.classId === selectedEntityId;
            if (viewMode === 'TEACHER') return slot.teacherId === selectedEntityId;
            return false;
        });
    }, [schedule, viewMode, selectedEntityId]);

    const slotMap = useMemo(() => {
        const map = new Map<string, ScheduleSlot>();
        filteredSlots.forEach(slot => {
            map.set(`${slot.day}-${slot.session}-${slot.period}`, slot);
        });
        return map;
    }, [filteredSlots]);

    const handleDragStart = (event: DragStartEvent) => {
        if (!isEditable) return;
        const slot = event.active.data.current as ScheduleSlot;
        setActiveSlot(slot);
        activeSlotRef.current = slot;
        setDragConflicts([]);
        dragConflictsRef.current = [];
    };

    const handleDragOver = (event: DragOverEvent) => {
        if (!isEditable || !activeSlotRef.current) return;
        if (!event.over?.data.current) {
            const empty: string[] = [];
            dragConflictsRef.current = empty;
            setDragConflicts(empty);
            return;
        }
        const over = event.over.data.current as { day: number; session: number; period: number };
        const actualPeriod = over.session === 1 ? over.period + 5 : over.period;
        const conflicts = computeConflicts(activeSlotRef.current, { day: over.day, period: actualPeriod }, schedule);
        dragConflictsRef.current = conflicts;
        setDragConflicts(conflicts);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (!isEditable) return;
        const { active, over } = event;

        if (over?.data.current) {
            const fromData = active.data.current as ScheduleSlot;
            const toData = over.data.current as { day: number; session: number; period: number };
            const actualToPeriod = toData.session === 1 ? toData.period + 5 : toData.period;
            const isSameCell = fromData.day === toData.day && fromData.period === actualToPeriod;

            if (!isSameCell) {
                if (dragConflictsRef.current.length > 0) {
                    onConflictLog?.(dragConflictsRef.current);
                } else {
                    onSlotMove?.(fromData, { day: toData.day, period: toData.period, session: toData.session });
                }
            }
        }

        setActiveSlot(null);
        activeSlotRef.current = null;
        setDragConflicts([]);
        dragConflictsRef.current = [];
    };

    const days = [2, 3, 4, 5, 6, 7];
    const periods = [1, 2, 3, 4, 5];
    const hasConflict = dragConflicts.length > 0;

    const renderCell = (day: number, session: number, period: number) => {
        const lookupPeriod = session === 1 ? period + 5 : period;
        const slot = slotMap.get(`${day}-${session}-${lookupPeriod}`);

        return (
            <DroppableCell key={`${day}-${session}-${period}`} day={day} session={session} period={period} hasConflict={hasConflict}>
                {slot ? (
                    <DraggableSlot slot={slot} viewMode={viewMode} isEditable={isEditable} onToggleLock={onToggleLock} />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-200 text-xs">-</div>
                )}
            </DroppableCell>
        );
    };

    return (
        <DndContext onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className="bg-[var(--bg-surface)] rounded-lg shadow-sm overflow-hidden border border-[var(--border-default)] select-none">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] text-sm font-bold border-b-2 border-[var(--border-default)]">
                            <tr>
                                <th className="p-3 border border-[var(--border-default)] w-16 text-center bg-[var(--bg-surface-hover)]">Buổi</th>
                                <th className="p-3 border border-[var(--border-default)] w-12 text-center bg-[var(--bg-surface-hover)]">Tiết</th>
                                {days.map(d => (
                                    <th key={d} className="p-3 border border-[var(--border-default)] text-center w-32 bg-[var(--bg-surface-hover)]">
                                        {DAY_LABELS[d] ?? `Thứ ${d}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-sm text-[var(--text-secondary)]">
                            {periods.map((p, index) => (
                                <tr key={`morning-${p}`}>
                                    {index === 0 && (
                                        <td rowSpan={5} className="p-2 border border-[var(--border-default)] text-center font-bold bg-blue-50 text-blue-800 align-middle">
                                            SÁNG
                                        </td>
                                    )}
                                    <td className="p-2 border border-[var(--border-default)] text-center font-bold bg-[var(--bg-surface-hover)]">{p}</td>
                                    {days.map(d => renderCell(d, 0, p))}
                                </tr>
                            ))}

                            <tr className="bg-gray-200 h-1"><td colSpan={8}></td></tr>

                            {periods.map((p, index) => (
                                <tr key={`afternoon-${p}`}>
                                    {index === 0 && (
                                        <td rowSpan={5} className="p-2 border border-[var(--border-default)] text-center font-bold bg-orange-50 text-orange-800 align-middle">
                                            CHIỀU
                                        </td>
                                    )}
                                    <td className="p-2 border border-[var(--border-default)] text-center font-bold bg-[var(--bg-surface-hover)]">{p}</td>
                                    {days.map(d => renderCell(d, 1, p))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditable && (
                <DragOverlay>
                    {activeSlot ? (
                        <div className="w-32 pointer-events-none cursor-grabbing">
                            <div className="h-20 opacity-90">
                                <SlotContent slot={activeSlot} viewMode={viewMode} isOverlay={true} />
                            </div>
                            {hasConflict && (
                                <div className="mt-1 rounded px-2 py-0.5 text-[11px] font-bold text-white bg-red-600 shadow text-center">
                                    ⚠️ Xung đột
                                </div>
                            )}
                            {!hasConflict && activeSlot && (
                                <div className="mt-1 rounded px-2 py-0.5 text-[11px] font-bold text-white bg-green-600 shadow text-center">
                                    ✓ Hợp lệ
                                </div>
                            )}
                        </div>
                    ) : null}
                </DragOverlay>
            )}
        </DndContext>
    );
}
