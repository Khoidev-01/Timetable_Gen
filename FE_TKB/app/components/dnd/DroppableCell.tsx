'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableCellProps {
    id?: string;
    children?: React.ReactNode;
    /** true: legal target · false: would break a rule · null: nothing being dragged */
    isValid?: boolean | null;
    /** Short explanation shown on the cell: the score change, or why it is refused. */
    hint?: string;
    activeId?: string | null;
    day?: number;
    session?: number;
    period?: number;
    isOccupied?: boolean;
}

export function DroppableCell({ id, children, isValid, hint, day, session, period }: DroppableCellProps) {
    const cellId = id ?? `${day}-${session}-${period}`;
    const { setNodeRef, isOver } = useDroppable({
        id: cellId,
        data: { day, session, period },
    });

    // While a slot is in the air every cell is tinted, so the whole grid answers
    // "where can this go?" at a glance rather than one cell at a time on hover
    let bgClass = 'hover:bg-gray-50/80';

    if (isValid === true) {
        bgClass = isOver
            ? 'bg-emerald-100 ring-2 ring-inset ring-emerald-500 z-20'
            : 'bg-emerald-50/70';
    } else if (isValid === false) {
        bgClass = isOver
            ? 'bg-red-100 ring-2 ring-inset ring-red-400 z-20'
            : 'bg-red-50/50';
    } else if (isOver) {
        bgClass = 'bg-gray-100';
    }

    return (
        <div
            ref={setNodeRef}
            className={`relative h-full min-h-[100px] w-full p-1 transition-all duration-200 ${bgClass}`}
        >
            {children}

            {/* The cost of this move, or the reason it is refused */}
            {isOver && hint && (
                <div className="pointer-events-none absolute inset-x-1 bottom-1 z-30">
                    <span
                        className={`block truncate rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                            isValid ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                        }`}
                    >
                        {hint}
                    </span>
                </div>
            )}

            {!children && isValid === true && !isOver && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-emerald-300">trống</span>
                </div>
            )}
        </div>
    );
}
