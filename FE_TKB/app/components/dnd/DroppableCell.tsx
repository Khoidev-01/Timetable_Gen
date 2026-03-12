'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableCellProps {
    id: string; // format: "classId-day-period"
    children?: React.ReactNode;
    isValid?: boolean | null; // true: valid, false: invalid (conflict), null: neutral
    activeId?: string | null;
    day?: number;
    period?: number;
    isOccupied?: boolean;
}

export function DroppableCell({ id, children, isValid, activeId, day, period, isOccupied }: DroppableCellProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    let bgClass = '';

    if (isOver) {
        if (isValid === false) {
            bgClass = 'bg-red-50 ring-2 ring-inset ring-red-400 z-20';
        } else if (isValid === true) {
            bgClass = 'bg-blue-50 ring-2 ring-inset ring-blue-400 z-20';
        } else {
            bgClass = 'bg-gray-100';
        }
    } else {
        bgClass = 'hover:bg-gray-50/80';
    }

    return (
        <div
            ref={setNodeRef}
            className={`
                relative w-full h-full p-1 min-h-[100px] transition-all duration-200
                ${bgClass}
            `}
        >
            {children}

            {/* Empty State Hint (Optional) */}
            {!children && isOver && isValid && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-blue-300 text-xs font-medium">Thả vào đây</span>
                </div>
            )}
            {!children && isOver && isValid === false && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-red-300 text-xs font-medium">Trùng lịch</span>
                </div>
            )}
        </div>
    );
}
