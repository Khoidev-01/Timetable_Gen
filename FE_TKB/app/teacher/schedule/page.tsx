
'use client';
import { useState, useEffect } from 'react';
import TimetableGrid from '@/app/components/admin/TimetableGrid';
import { API_URL } from '@/lib/api';

interface Semester {
    id: string;
    name: string;
    is_current?: boolean;
    yearName?: string;
}

interface Teacher {
    id: string;
    full_name: string;
    code: string;
}

export default function TeacherSchedulePage() {
    const [schedule, setSchedule] = useState<any[]>([]);
    const [selectedSemester, setSelectedSemester] = useState<string>('');
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [viewTeacherId, setViewTeacherId] = useState<string>('');
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load user and initial data
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        fetchSemesters();
        fetchTeachers();
    }, []);

    // Set default view to self when teachers list is loaded and user is known
    useEffect(() => {
        if (user && teachers.length > 0 && !viewTeacherId) {
            // Match teacher by full_name or teacher_profile linked in User object
            // Assuming User object from Login now might have teacher_profile?
            // If not, we try to match by name (legacy) or just default to null
            // The previous logic used ho_ten === user.ho_ten.
            // New logic: user.teacher_profile?.id if present, else match name.
            if (user.teacher_profile?.id) {
                setViewTeacherId(user.teacher_profile.id);
            } else {
                const myself = teachers.find(t => t.full_name === user.full_name || t.full_name === user.username);
                if (myself) setViewTeacherId(myself.id);
            }
        }
    }, [user, teachers, viewTeacherId]);

    const fetchSemesters = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/system/years`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const years: any[] = await res.json();
                // Flatten semesters
                const sems: Semester[] = [];
                years.forEach(y => {
                    if (y.semesters) {
                        y.semesters.forEach((s: any) => {
                            sems.push({ ...s, yearName: y.name });
                        });
                    }
                });
                setSemesters(sems);
                // Select active
                const current = sems.find(s => s.is_current) || sems[0];
                if (current) setSelectedSemester(current.id);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchTeachers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/resources/teachers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTeachers(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSchedule = async () => {
        if (!selectedSemester || !viewTeacherId) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/algorithm/result/${selectedSemester}?teacherId=${viewTeacherId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSchedule(data);
            } else {
                setSchedule([]);
            }
        } catch (error) {
            console.error(error);
            setSchedule([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, [selectedSemester, viewTeacherId]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex gap-4 items-center flex-wrap">
                    <h1 className="text-xl font-bold text-gray-800">My Timetable</h1>

                    <select
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 text-sm"
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                    >
                        {semesters.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.yearName})</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2 border-l pl-4 ml-2">
                        <span className="text-sm text-gray-600">Viewing:</span>
                        <select
                            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm font-medium text-emerald-700 min-w-[200px]"
                            value={viewTeacherId}
                            onChange={(e) => setViewTeacherId(e.target.value)}
                        >
                            <option value="">-- Select Teacher --</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.full_name} {user && (user.teacher_profile?.id === t.id || user.full_name === t.full_name) ? '(Me)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                )}

                {schedule.length > 0 ? (
                    <TimetableGrid
                        schedule={schedule}
                        isEditable={false} // Teachers cannot edit timetable, only view
                        viewMode="TEACHER"
                        selectedEntityId={viewTeacherId}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                        No timetable data found.
                    </div>
                )}
            </div>
        </div>
    );
}
