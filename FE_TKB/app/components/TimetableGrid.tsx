'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { setSchedule, moveLesson, ScheduleSlot } from '@/lib/features/schedule/scheduleSlice';
import { DndContext, DragEndEvent, TouchSensor, MouseSensor, useSensor, useSensors, DragStartEvent } from '@dnd-kit/core';
import { DraggableLesson } from './dnd/DraggableLesson';
import { DroppableCell } from './dnd/DroppableCell';
import TeacherRegistration from './TeacherRegistration';
import ConstraintConfig from './ConstraintConfig';

// Fallback data (Moved outside to be shared)
const FALLBACK_SUBJECTS = [
    { id: 'TOAN', ten_mon: 'Toán' },
    { id: 'VAN', ten_mon: 'Văn' },
    { id: 'ANH', ten_mon: 'Anh' },
    { id: 'LY', ten_mon: 'Lý' },
    { id: 'HOA', ten_mon: 'Hóa' },
    { id: 'SINH', ten_mon: 'Sinh' },
    { id: 'SU', ten_mon: 'Sử' },
    { id: 'DIA', ten_mon: 'Địa' }
];
const FALLBACK_TEACHERS = [{ id: 'GV1', ho_ten: 'Nguyễn Văn A' }, { id: 'GV2', ho_ten: 'Trần Thị B' }];

// MOCK DATA GENERATOR (Fallback)
const generateMockData = (realClasses: any[] = [], metadata: { subjects: any[], teachers: any[] } = { subjects: [], teachers: [] }): ScheduleSlot[] => {
    const slots: ScheduleSlot[] = [];
    const classes = realClasses.length > 0
        ? realClasses
        : [{ id: '10A1', ten_lop: '10A1' }, { id: '10A2', ten_lop: '10A2' }, { id: '11B1', ten_lop: '11B1' }];

    const subjects = (metadata.subjects && metadata.subjects.length > 2) ? metadata.subjects : FALLBACK_SUBJECTS;
    const teachers = (metadata.teachers && metadata.teachers.length > 0) ? metadata.teachers : FALLBACK_TEACHERS;

    classes.forEach(cls => {
        for (let day = 2; day <= 7; day++) {
            for (let period = 1; period <= 10; period++) {
                if (Math.random() > (period > 5 ? 0.7 : 0.3)) {
                    const randomSub = subjects[Math.floor(Math.random() * subjects.length)];
                    const randomTea = teachers[Math.floor(Math.random() * teachers.length)];

                    slots.push({
                        id: `${cls.id}-${day}-${period}-lesson`,
                        classId: cls.id,
                        subjectId: randomSub.id, // Use Real UUID
                        teacherId: randomTea.id, // Use Real UUID
                        teacherName: randomTea.ho_ten,
                        roomName: `P.${100 + Math.floor(Math.random() * 20)}`,
                        day,
                        period
                    });
                }
            }
        }
    });
    return slots;
};

interface TimetableGridProps {
    currentUser?: any;
    onLogout?: () => void;
}

export default function TimetableGrid({ currentUser, onLogout }: TimetableGridProps) {
    const dispatch = useAppDispatch();
    const schedule = useAppSelector((state) => state.schedule.data);

    const [fetchedClasses, setFetchedClasses] = useState<any[]>([]);
    const [fetchedMetadata, setFetchedMetadata] = useState<{ subjects: any[], teachers: any[] }>({ subjects: [], teachers: [] });
    const [isSaving, setIsSaving] = useState(false);

    const [activeId, setActiveId] = useState<string | null>(null);
    // View State
    const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>(currentUser?.role === 'TEACHER' ? 'TEACHER' : 'CLASS');
    const [selectedClass, setSelectedClass] = useState<string | null>(currentUser?.role === 'TEACHER' ? currentUser.username : null);

    // Feedback State
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({ tieu_de: '', noi_dung: '' });
    const [isSendingFeedback, setIsSendingFeedback] = useState(false);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
    );

    // Helper to get Subject Name from ID
    const getSubjectName = (id: string) => {
        let sub = fetchedMetadata.subjects.find(s => s.id === id);
        if (!sub) sub = FALLBACK_SUBJECTS.find(s => s.id === id);
        return sub ? sub.ten_mon : id;
    };

    // Helper to get Teacher Name from ID (optional, if lesson.teacherName is empty)
    const getTeacherName = (id: string) => {
        let tea = fetchedMetadata.teachers.find(t => t.id === id);
        if (!tea) tea = FALLBACK_TEACHERS.find(t => t.id === id);
        return tea ? tea.ho_ten : id;
    };

    // Helper to Regenerate Mock Data
    const handleRegenerate = () => {
        if (confirm("Bạn có chắc muốn tạo lại dữ liệu mẫu không? Dữ liệu hiện tại sẽ bị mất.")) {
            dispatch(setSchedule(generateMockData(fetchedClasses, fetchedMetadata)));
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const SEMESTER_ID = 'e4c0a561-144a-4fbe-9016-40023b8f1a95';

                // 1. Fetch Metadata (Classes, Subjects, Teachers)
                const [classRes, metaRes, scheduleRes] = await Promise.all([
                    fetch(`http://localhost:4000/algorithm/classes/${SEMESTER_ID}`),
                    fetch(`http://localhost:4000/algorithm/metadata`),
                    fetch(`http://localhost:4000/algorithm/result/${SEMESTER_ID}`)
                ]);

                const classData = await classRes.json();
                const metaData = await metaRes.json();
                const scheduleData = await scheduleRes.json();

                setFetchedClasses(classData);
                setFetchedMetadata(metaData); // Store metadata

                if (Array.isArray(scheduleData) && scheduleData.length > 0) {
                    dispatch(setSchedule(scheduleData));
                } else {
                    console.warn("No data found from API. Using Mock with Real Metadata.");
                    dispatch(setSchedule(generateMockData(classData, metaData)));
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
                if (schedule.length === 0) {
                    dispatch(setSchedule(generateMockData()));
                }
            }
        };

        if (schedule.length === 0) {
            fetchData();
        }
    }, [dispatch, schedule.length]);

    // Extract unique classes from schedule OR use fetched classes
    // If schedule is empty/mock, extracting from schedule works IF mock uses real IDs.
    // Display Name mapping:
    const getClassInfo = (id: string) => {
        const found = fetchedClasses.find(c => c.id === id);
        return found ? found.ten_lop : id; // Fallback to ID if not found
    };

    const uniqueClassIds = useMemo(() => {
        return Array.from(new Set(schedule.map(s => s.classId))).sort();
    }, [schedule]);

    // Update active class mapping
    useEffect(() => {
        if (!selectedClass && uniqueClassIds.length > 0) {
            setSelectedClass(uniqueClassIds[0]);
        }
    }, [uniqueClassIds, selectedClass]);

    const checkConflict = (targetClass: string, targetDay: number, targetPeriod: number, activeLessonId: string | null): boolean => {
        if (!activeLessonId) return false;
        const activeLesson = schedule.find(s => s.id === activeLessonId);
        if (!activeLesson || !activeLesson.teacherId) return false;

        // Check if teacher is busy in another class at the same time
        return schedule.some(s =>
            s.teacherId === activeLesson.teacherId &&
            s.day === targetDay &&
            s.period === targetPeriod &&
            s.classId !== targetClass // Conflict is with OTHER classes
        );
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            // over.id format: "classId-day-period"
            const [classId, dayStr, periodStr] = (over.id as string).split('-');
            const day = parseInt(dayStr);
            const period = parseInt(periodStr);

            if (checkConflict(classId, day, period, active.id as string)) {
                return; // Block invalid drops
            }

            dispatch(moveLesson({
                id: active.id as string,
                day,
                period
            }));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const SEMESTER_ID = 'e4c0a561-144a-4fbe-9016-40023b8f1a95'; // Hardcoded for now, should come from context/url

            // Prepare payload
            // ScheduleSlot matches backend expectation roughly
            const payload = {
                semesterId: SEMESTER_ID,
                schedule: schedule
            };

            const response = await fetch('http://localhost:4000/algorithm/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('Failed to save schedule');
            }

            const result = await response.json();
            // console.log("Save successful:", result);
            alert("Đã lưu lịch thành công vào CSDL!");
        } catch (error) {
            console.error("Error saving schedule:", error);
            alert("Lưu thất bại! Vui lòng kiểm tra console.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendFeedback = async () => {
        if (!selectedClass || viewMode !== 'TEACHER') {
            alert("Vui lòng chọn một giáo viên để gửi phản hồi!");
            return;
        }
        if (!feedbackForm.tieu_de || !feedbackForm.noi_dung) {
            alert("Vui lòng nhập tiêu đề và nội dung!");
            return;
        }

        setIsSendingFeedback(true);
        try {
            const response = await fetch('http://localhost:4000/phan-hoi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    giao_vien_id: selectedClass, // In Teacher Mode, selectedClass IS the teacherId
                    tieu_de: feedbackForm.tieu_de,
                    noi_dung: feedbackForm.noi_dung
                })
            });

            if (response.ok) {
                alert("Đã gửi phản hồi thành công!");
                setShowFeedbackModal(false);
                setFeedbackForm({ tieu_de: '', noi_dung: '' });
            } else {
                throw new Error("Failed to send");
            }
        } catch (error) {
            console.error(error);
            alert("Gửi phản hồi thất bại!");
        } finally {
            setIsSendingFeedback(false);
        }
    };

    const days = [2, 3, 4, 5, 6, 7]; // Mon-Sat
    const periods = Array.from({ length: 10 }, (_, i) => i + 1);

    const handleToggleLock = async (lessonId: string) => {
        // Optimistic UI update
        const updatedSchedule = schedule.map(lesson =>
            lesson.id === lessonId ? { ...lesson, isLocked: !lesson.isLocked } : lesson
        );
        dispatch(setSchedule(updatedSchedule));

        // Call Backend API
        /*
        try {
            await fetch(`http://localhost:4000/algorithm/lock/${lessonId}`, { method: 'POST' });
        } catch (error) {
            console.error("Failed to lock lesson:", error);
            // Revert on failure
             dispatch(setSchedule(schedule));
        }
        */
        // Note: Since we are saving the whole schedule via /save, the lock status will be persisted there if we include it in the saved data.
        // However, for immediate feedback or specific lock API, we can implement separate endpoint.
        // For now, let's assume it saves with the main Save button or we add a specific PATCH.
        // Let's implement a specific patch for locking to be safe and instant.
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col h-screen bg-gray-50 border-t border-gray-200">
                {/* Top Controls Bar */}
                <header className="bg-white px-6 py-4 flex justify-between items-center shadow-sm z-30 shrink-0 h-16 border-b">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 rounded text-blue-600">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <span className="font-bold text-slate-700">Thời Khóa Biểu</span>

                            {/* User Info & Logout */}
                            {currentUser && (
                                <div className="flex items-center gap-3 ml-4 border-l pl-4 py-1">
                                    <div className="text-xs text-right hidden sm:block">
                                        <div className="font-bold text-slate-700">{currentUser.username}</div>
                                        <div className="text-slate-500 uppercase text-[10px]">{currentUser.role}</div>
                                    </div>
                                    <button
                                        onClick={onLogout}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        title="Đăng xuất"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                                            <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>


                        <div className="h-6 w-px bg-gray-200 mx-2"></div>

                        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span> Trùng Lịch
                            <span className="w-2 h-2 rounded-full bg-blue-500 ml-2"></span> Hợp Lệ
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => { setViewMode('CLASS'); setSelectedClass(null); }}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'CLASS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Theo Lớp
                            </button>
                            <button
                                onClick={() => { setViewMode('TEACHER'); setSelectedClass(null); }}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'TEACHER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Theo Giáo Viên
                            </button>
                        </div>

                        {/* Feedback Button (Only in Teacher Mode - Moved to Right of Toggle) */}
                        {/* Feedback Button (Only in Teacher Mode - Moved to Right of Toggle) */}
                        {viewMode === 'TEACHER' && (
                            <button
                                onClick={() => {
                                    if (!selectedClass) {
                                        alert("Vui lòng chọn một giáo viên để gửi phản hồi!");
                                        return;
                                    }
                                    setShowFeedbackModal(true);
                                }}
                                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold border border-orange-200 hover:bg-orange-100 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                </svg>
                                Gửi Phản Hồi
                            </button>
                        )}

                        {/* Registration Button (Only in Teacher Mode - Moved to Right of Feedback) */}
                        {/* Registration Button (Only in Teacher Mode - Moved to Right of Feedback) */}
                        {viewMode === 'TEACHER' && (
                            <button
                                onClick={() => {
                                    if (!selectedClass) {
                                        alert("Vui lòng chọn một giáo viên để đăng ký lịch bận!");
                                        return;
                                    }
                                    setShowRegistrationModal(true);
                                }}
                                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold border border-purple-200 hover:bg-purple-100 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13.25a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V4.75Z" clipRule="evenodd" />
                                </svg>
                                Đăng Ký Bận
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Admin Config Button */}
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                            title="Cấu hình Ràng buộc"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.047 7.047 0 0 1 0-2.228l-1.267-1.113a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                            </svg>
                        </button>

                        <button
                            onClick={handleRegenerate}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-slate-600 border border-gray-200 hover:bg-slate-50 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0v2.43l-.31-.31a7 7 0 0 0-11.712 3.138.75.75 0 0 0 1.449.39 5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h4.242Z" clipRule="evenodd" />
                            </svg>
                            Tạo Dữ Liệu Giả
                        </button>

                        <button
                            onClick={() => {
                                const SEMESTER_ID = 'e4c0a561-144a-4fbe-9016-40023b8f1a95';
                                window.open(`http://localhost:4000/data-export/${SEMESTER_ID}`, '_blank');
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 0 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
                            </svg>
                            Xuất Excel
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu Thời Khóa Biểu'}
                        </button>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Class List */}
                    <aside className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex flex-col shrink-0">
                        <div className="p-4 border-b border-gray-100 bg-slate-50 sticky top-0 z-10">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {viewMode === 'CLASS' ? 'Danh Sách Lớp' : 'Danh Sách Giáo Viên'}
                            </h2>
                        </div>
                        <div className="p-2 space-y-1">
                            {viewMode === 'CLASS' ? (
                                uniqueClassIds.map(clsId => (
                                    <button
                                        key={clsId}
                                        onClick={() => setSelectedClass(clsId)}
                                        className={`
                                            w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all
                                            flex items-center justify-between group
                                            ${selectedClass === clsId
                                                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                        `}
                                    >
                                        <span>{getClassInfo(clsId)}</span>
                                        {selectedClass === clsId && (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                ))
                            ) : (
                                (fetchedMetadata.teachers.length > 0 ? fetchedMetadata.teachers : FALLBACK_TEACHERS).map(teacher => (
                                    <button
                                        key={teacher.id}
                                        onClick={() => setSelectedClass(teacher.id)}
                                        className={`
                                            w-full text-left px-4 py-3 rounded-lg text-sm font-semibold transition-all
                                            flex items-center justify-between group
                                            ${selectedClass === teacher.id
                                                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                        `}
                                    >
                                        <span>{teacher.ho_ten}</span>
                                        {selectedClass === teacher.id && (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>

                    {/* Main Grid: Schedule */}
                    <main className="flex-1 overflow-auto bg-slate-50 p-6 relative">
                        {!selectedClass ? (
                            <div className="flex h-full items-center justify-center text-slate-400">
                                <p>Vui lòng chọn một {viewMode === 'CLASS' ? 'lớp' : 'giáo viên'} để xem thời khóa biểu</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden min-w-[800px]">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="w-24 p-4 text-center text-xs font-bold text-slate-500 uppercase bg-slate-50 border-b border-r border-slate-200">
                                                Tiết / Thứ
                                            </th>
                                            {days.map(day => (
                                                <th key={day} className="p-4 text-center text-sm font-bold text-slate-700 bg-slate-50 border-b border-r border-slate-200 last:border-r-0">
                                                    Thứ {day}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {periods.map(period => (
                                            <tr key={period} className={`
                                                ${period === 6 ? 'border-t-4 border-t-slate-200' : ''}
                                            `}>
                                                {/* Period Header Column */}
                                                <td className="p-3 bg-slate-50 border-r border-slate-200 text-center font-bold text-slate-500 text-sm">
                                                    Tiết {period}
                                                    <div className="text-[10px] font-normal text-slate-400 mt-1">
                                                        {period <= 5 ? 'Sáng' : 'Chiều'}
                                                    </div>
                                                </td>

                                                {/* Day Columns */}
                                                {days.map(day => {
                                                    const cellId = `${selectedClass}-${day}-${period}`;
                                                    let lesson = null;

                                                    if (viewMode === 'CLASS') {
                                                        lesson = schedule.find(s => s.classId === selectedClass && s.day === day && s.period === period);
                                                    } else {
                                                        lesson = schedule.find(s => s.teacherId === selectedClass && s.day === day && s.period === period);
                                                    }

                                                    const isConflict = checkConflict(selectedClass, day, period, activeId);
                                                    // In Teacher view, conflict check logic might differ or we disable it for simplicity first
                                                    const isValid = activeId ? !isConflict : null;

                                                    return (
                                                        <td key={`${day}-${period}`} className="p-1 border-r border-slate-200 border-b relative min-w-[140px] h-[100px] bg-white hover:bg-slate-50 transition-colors">
                                                            <DroppableCell
                                                                id={cellId}
                                                                activeId={activeId}
                                                                day={day}
                                                                period={period}
                                                                isOccupied={!!lesson}
                                                                isValid={isValid}
                                                            >
                                                                {lesson && (
                                                                    <DraggableLesson
                                                                        id={lesson.id}
                                                                        subject={getSubjectName(lesson.subjectId)}
                                                                        teacher={viewMode === 'CLASS'
                                                                            ? (lesson.teacherName || getTeacherName(lesson.teacherId || ''))
                                                                            : getClassInfo(lesson.classId) // Show Class Name in Teacher View
                                                                        }
                                                                        room={lesson.roomName}
                                                                        isLocked={lesson.isLocked}
                                                                        onToggleLock={handleToggleLock}
                                                                    />
                                                                )}
                                                            </DroppableCell>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* State for Registration Modal - assuming this is inside a functional component */}
            {/* You would typically declare this at the top of your component function, e.g.,
            const [showRegistrationModal, setShowRegistrationModal] = useState(false);
            */}

            {
                showRegistrationModal && selectedClass && viewMode === 'TEACHER' && (
                    <TeacherRegistration
                        teacherId={selectedClass}
                        onClose={() => setShowRegistrationModal(false)}
                    />
                )
            }

            {/* Feedback Modal */}
            {
                showConfigModal && (
                    <ConstraintConfig
                        onClose={() => setShowConfigModal(false)}
                    />
                )
            }

            {/* Feedback Modal */}
            {
                showFeedbackModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-slate-700">Gửi Phản Hồi</h3>
                                <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tiêu đề</label>
                                    <input
                                        type="text"
                                        value={feedbackForm.tieu_de}
                                        onChange={e => setFeedbackForm({ ...feedbackForm, tieu_de: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all"
                                        placeholder="VD: Trùng lịch dạy..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nội dung</label>
                                    <textarea
                                        value={feedbackForm.noi_dung}
                                        onChange={e => setFeedbackForm({ ...feedbackForm, noi_dung: e.target.value })}
                                        rows={4}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all resize-none"
                                        placeholder="Mô tả chi tiết vấn đề..."
                                    ></textarea>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex justify-end gap-2">
                                <button
                                    onClick={() => setShowFeedbackModal(false)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSendFeedback}
                                    disabled={isSendingFeedback}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50"
                                >
                                    {isSendingFeedback ? 'Đang gửi...' : 'Gửi Phản Hồi'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </DndContext >
    );
}
