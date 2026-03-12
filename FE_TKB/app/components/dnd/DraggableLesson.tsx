'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableLessonProps {
    id: string; // lessonId
    subject: string;
    teacher: string | null;
    room?: string;
    isLocked?: boolean;
    onToggleLock?: (id: string) => void;
}

// Generate a consistent pastel color from a string
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 90%)`; // Pastel background
};

const stringToBorderColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 70%)`; // Darker border
};

export function DraggableLesson({ id, subject, teacher, room, isLocked, onToggleLock }: DraggableLessonProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: id,
        data: { subject, teacher },
        disabled: isLocked, // Disable drag if locked
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        backgroundColor: stringToColor(subject),
        borderColor: stringToBorderColor(subject),
        zIndex: isDragging ? 999 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                absolute inset-1 rounded-lg border p-2 flex flex-col justify-between
                ${isLocked ? 'border-red-300 bg-slate-100' : 'cursor-grab active:cursor-grabbing hover:shadow-md'}
                shadow-sm transition-all duration-200
                group overflow-hidden
                ${isDragging ? 'shadow-xl scale-105 opacity-90' : ''}
            `}
        >
            {/* Subject Header */}
            <div className="flex items-start justify-between">
                <div className="font-bold text-sm text-gray-800 tracking-tight truncate uppercase" title={subject}>
                    {subject}
                </div>

                {/* Lock Button */}
                <button
                    onPointerDown={(e) => {
                        e.stopPropagation(); // Prevent drag start
                        onToggleLock?.(id);
                    }}
                    className={`ml-1 -mt-1 p-1 rounded-full hover:bg-gray-200 transition-colors ${isLocked ? 'text-red-500' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
                    title={isLocked ? "Mở khóa" : "Khóa tiết học"}
                >
                    {isLocked ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Details Footer */}
            <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1 text-[11px] text-gray-700 font-medium truncate" title={teacher || ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-gray-500 shrink-0">
                        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
                    </svg>
                    <span className="truncate">{teacher || '---'}</span>
                </div>

                {room && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-600 truncate">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-gray-500 shrink-0">
                            <path fillRule="evenodd" d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1V3Zm10 1H4v1h8V4Z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold bg-white/60 px-1 rounded">{room}</span>
                    </div>
                )}
            </div>

            {/* Hover Grip Indicator */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-30 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path d="M5 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm1 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3-8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm1 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3-8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm1 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
                </svg>
            </div>
        </div>
    );
}
