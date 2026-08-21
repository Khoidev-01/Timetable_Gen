'use client';
import { useMemo, useState } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { API_URL } from '@/lib/api';

interface MoveTarget { day: number; period: number; valid: boolean; reason?: string; deltaScore?: number }

interface ScheduleSlot {
    id: string;
    classId: string;
    class?: { name: string };
    className?: string; // Backend returns this
    subjectId: string;
    subject?: { name: string; code: string; color?: string };
    subjectName?: string; // Backend returns this
    teacherId?: string;
    teacher?: { full_name: string; code: string };
    teacherName?: string; // Backend returns this
    roomId?: string;
    room?: { name: string };
    roomName?: string; // Backend returns this
    day: number;
    period: number;
    session: number; // 0: Morning, 1: Afternoon
    is_locked?: boolean;
}

interface TimetableGridProps {
    schedule: ScheduleSlot[];
    viewMode: 'CLASS' | 'TEACHER';
    selectedEntityId: string;
    onSlotMove?: (from: ScheduleSlot, to: { day: number, period: number, session: number }) => void;
    onToggleLock?: (slotId: string) => void;
    onRequestSwap?: (slotId: string) => void;
    /** Ids of periods responsible for a hard violation, so they can be pointed at. */
    offenderIds?: Set<string>;
    isEditable?: boolean;
}

// Visual Component for slot content
// Helper to make color pastel/transparent
const hexToRgba = (hex: string | undefined, alpha: number) => {
    if (!hex) return 'rgba(235, 248, 255, 0.5)'; // default light blue
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

// Visual Component for slot content
const SlotContent = ({ slot, viewMode, isOverlay = false }: { slot: ScheduleSlot, viewMode: 'CLASS' | 'TEACHER', isOverlay?: boolean }) => {
    // Pastel background
    const rawColor = slot.subject?.color;
    const bgColor = hexToRgba(rawColor, 0.25); // 25% opacity
    const borderColor = hexToRgba(rawColor, 0.8) || '#cbd5e1';

    return (
        <div
            className={`flex flex-col gap-0.5 items-center justify-center h-full w-full rounded-md p-1 border transition-all shadow-sm
            ${isOverlay ? 'scale-105 z-50 ring-2 ring-blue-400' : 'hover:brightness-95 hover:shadow-md'}`}
            style={{
                backgroundColor: bgColor,
                borderColor: borderColor,
                borderWidth: '1px',
                borderLeftWidth: '4px'
            }}
        >
            <span className="font-extrabold text-gray-900 text-[13px] leading-tight text-center drop-shadow-sm uppercase tracking-wide">
                {slot.subject?.name || slot.subjectName || slot.subjectId}
            </span>
            <span className="text-[11px] text-gray-700 font-semibold leading-tight text-center mt-0.5">
                {viewMode === 'CLASS' ? (slot.teacher?.full_name || slot.teacherName || slot.teacherId) : (slot.class?.name || slot.className || slot.classId)}
            </span>
            {(slot.room?.name || slot.roomName) && (
                <span className="text-[10px] bg-white/60 text-black px-1.5 rounded-full border border-black/10 shadow-sm mt-0.5 font-mono">
                    {slot.room?.name || slot.roomName}
                </span>
            )}
        </div>
    );
};

// Draggable Slot Component
const DraggableSlot = ({ slot, viewMode, isEditable, onToggleLock, onRequestSwap, isOffender }: { slot: ScheduleSlot, viewMode: 'CLASS' | 'TEACHER', isEditable: boolean, onToggleLock?: (id: string) => void, onRequestSwap?: (id: string) => void, isOffender?: boolean }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `drag-${slot.day}-${slot.session}-${slot.period}`,
        data: slot,
        disabled: !isEditable || slot.is_locked // Disable drag if Locked
    });

    return (
        <div
            ref={setNodeRef}
            title={isOffender ? 'Tiết này đang gây lỗi cứng' : undefined}
            className={`${isEditable && !slot.is_locked ? 'cursor-move' : 'cursor-default'} h-full w-full relative group
                ${isDragging ? 'opacity-30' : 'opacity-100'}
                ${isOffender ? 'rounded ring-2 ring-red-500 ring-offset-1' : ''}`}
        >
            <div {...listeners} {...attributes} className="h-full w-full">
                <SlotContent slot={slot} viewMode={viewMode} />
            </div>

            {/* Lock Button (Visible on Hover or if Locked) */}
            {isEditable && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleLock) onToggleLock(slot.id);
                    }}
                    className={`absolute top-1 right-1 p-1 rounded-full shadow-sm transition-all z-10
                        ${slot.is_locked
                            ? 'bg-red-100 text-red-600 opacity-100'
                            : 'bg-white text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50'}
                    `}
                    title={slot.is_locked ? "Click to Unlock" : "Click to Lock"}
                >
                    {slot.is_locked ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                    )}
                </button>
            )}

            {/* Chain swap: useful exactly when a direct move is refused */}
            {isEditable && !slot.is_locked && onRequestSwap && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRequestSwap(slot.id);
                    }}
                    className="absolute top-1 left-1 z-10 rounded-full bg-white p-1 text-gray-400 opacity-0
                        shadow-sm transition-all group-hover:opacity-100 hover:bg-purple-50 hover:text-purple-600"
                    title="Tìm chu trình đổi tiết"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
            )}
        </div>
    );
};

// Droppable Cell Component
const DroppableCell = ({
    day,
    session,
    period,
    children,
    isValid,
    hint,
}: {
    day: number;
    session: number;
    period: number;
    children: React.ReactNode;
    /** true: legal target · false: would break a rule · null: nothing being dragged */
    isValid?: boolean | null;
    /** The score change if dropped here, or why the cell refuses the slot. */
    hint?: string;
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `drop-${day}-${session}-${period}`,
        data: { day, session, period }
    });

    // Tinting every cell while a slot is in the air answers "where can this go?" in one
    // glance. Before this the grid accepted any drop and only complained afterwards.
    let tone = 'bg-white';
    if (isValid === true) tone = isOver ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-emerald-50/70';
    else if (isValid === false) tone = isOver ? 'bg-red-100 ring-2 ring-red-400' : 'bg-red-50/50';
    else if (isOver) tone = 'bg-gray-100 ring-2 ring-gray-300';

    return (
        <td
            ref={setNodeRef}
            className={`p-1 border border-gray-200 text-center relative h-20 align-top transition-colors ${tone}`}
        >
            {children}

            {isOver && hint && (
                <span
                    className={`pointer-events-none absolute inset-x-1 bottom-1 z-30 block truncate rounded
                        px-1 py-0.5 text-[10px] font-semibold text-white
                        ${isValid ? 'bg-emerald-600' : 'bg-red-600'}`}
                >
                    {hint}
                </span>
            )}
        </td>
    );
};

export default function TimetableGrid({ schedule, viewMode, selectedEntityId, onSlotMove, onToggleLock, onRequestSwap, offenderIds, isEditable = true }: TimetableGridProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null);
    // Legality of every cell for the slot currently in the air, keyed "day-period"
    const [moveTargets, setMoveTargets] = useState<Map<string, MoveTarget> | null>(null);

    // Filter slots for the selected entity
    const filteredSlots = useMemo(() => {
        return schedule.filter(slot => {
            if (viewMode === 'CLASS') return slot.classId === selectedEntityId;
            if (viewMode === 'TEACHER') return slot.teacherId === selectedEntityId;
            return false;
        });
    }, [schedule, viewMode, selectedEntityId]);

    // Group by Day-Session-Period
    const slotMap = useMemo(() => {
        const map = new Map<string, ScheduleSlot>();
        filteredSlots.forEach(slot => {
            // Key: "day-session-period"
            map.set(`${slot.day}-${slot.session}-${slot.period}`, slot);
        });
        return map;
    }, [filteredSlots]);

    const handleDragStart = async (event: DragStartEvent) => {
        if (!isEditable) return;
        const { active } = event;
        const dragged = active.data.current as ScheduleSlot;
        setActiveId(active.id as string);
        setActiveSlot(dragged);
        setMoveTargets(null);
        if (!dragged?.id) return;

        // Ask which cells this period may legally land on, so the grid can colour them
        // while the slot is still being dragged instead of refusing the drop afterwards
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/algorithm/move-targets/${dragged.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return;

            const body = await response.json();
            const map = new Map<string, MoveTarget>();
            for (const target of body.targets as MoveTarget[]) {
                map.set(`${target.day}-${target.period}`, target);
            }
            setMoveTargets(map);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (!isEditable) return;
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const fromData = active.data.current as ScheduleSlot;
            const toData = over.data.current as { day: number, session: number, period: number };

            if (onSlotMove) {
                if (onSlotMove) {
                    onSlotMove(
                        fromData, // Pass the whole slot object
                        { day: toData.day, period: toData.period, session: toData.session }
                    );
                }
            }
        }
        setActiveId(null);
        setActiveSlot(null);
        setMoveTargets(null);
    };

    const days = [2, 3, 4, 5, 6, 7];
    const periods = [1, 2, 3, 4, 5];

    const formatDelta = (delta?: number) => {
        if (delta === undefined) return undefined;
        if (delta === 0) return 'không đổi điểm';
        return `${delta > 0 ? '+' : ''}${delta} điểm`;
    };

    const renderCell = (day: number, session: number, period: number) => {
        // Fix: Backend uses 1-10 for periods. Frontend displays 1-5 per session.
        // If Afternoon (session 1), we must map display period 1 -> 6, 2 -> 7, etc.
        const lookupPeriod = session === 1 ? period + 5 : period;

        const slot = slotMap.get(`${day}-${session}-${lookupPeriod}`);
        const target = moveTargets?.get(`${day}-${lookupPeriod}`);
        const isDraggingThis = activeSlot?.day === day && activeSlot?.period === lookupPeriod;

        return (
            <DroppableCell
                key={`${day}-${session}-${period}`}
                day={day}
                session={session}
                period={period}
                isValid={!moveTargets || isDraggingThis ? null : (target?.valid ?? false)}
                hint={target?.valid ? formatDelta(target.deltaScore) : target?.reason}
            >
                {slot ? (
                    <DraggableSlot slot={slot} viewMode={viewMode} isEditable={isEditable} onToggleLock={onToggleLock} onRequestSwap={onRequestSwap} isOffender={offenderIds?.has(slot.id)} />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-200 text-xs">-</div>
                )}
            </DroppableCell>
        );
    };

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-300 select-none">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead className="bg-gray-100 text-gray-700 text-sm font-bold border-b-2 border-gray-300">
                            <tr>
                                <th className="p-3 border border-gray-300 w-16 text-center bg-gray-100">Buổi</th>
                                <th className="p-3 border border-gray-300 w-12 text-center bg-gray-100">Tiết</th>
                                {days.map(d => (
                                    <th key={d} className="p-3 border border-gray-300 text-center w-32 bg-gray-100">
                                        {d === 8 ? 'CN' : `Thứ ${d}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-sm text-gray-700">
                            {/* Morning Session (0) */}
                            {periods.map((p, index) => (
                                <tr key={`morning-${p}`}>
                                    {index === 0 && (
                                        <td rowSpan={5} className="p-2 border border-gray-300 text-center font-bold bg-blue-50 text-blue-800 align-middle">
                                            SÁNG
                                        </td>
                                    )}
                                    <td className="p-2 border border-gray-300 text-center font-bold bg-gray-50">{p}</td>
                                    {days.map(d => renderCell(d, 0, p))}
                                </tr>
                            ))}

                            {/* Divider */}
                            <tr className="bg-gray-200 h-1"><td colSpan={8}></td></tr>

                            {/* Afternoon Session (1) */}
                            {periods.map((p, index) => (
                                <tr key={`afternoon-${p}`}>
                                    {index === 0 && (
                                        <td rowSpan={5} className="p-2 border border-gray-300 text-center font-bold bg-orange-50 text-orange-800 align-middle">
                                            CHIỀU
                                        </td>
                                    )}
                                    <td className="p-2 border border-gray-300 text-center font-bold bg-gray-50">{p}</td>
                                    {days.map(d => renderCell(d, 1, p))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drag Overlay for REALTIME visual feedback - Only if Editable */}
            {isEditable && (
                <DragOverlay>
                    {activeId && activeSlot ? (
                        <div className="w-32 h-20 opacity-90 cursor-grabbing pointer-events-none">
                            <SlotContent slot={activeSlot} viewMode={viewMode} isOverlay={true} />
                        </div>
                    ) : null}
                </DragOverlay>
            )}
        </DndContext>
    );
}
