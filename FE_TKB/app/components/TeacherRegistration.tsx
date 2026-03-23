'use client';

import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

interface TeacherRegistrationProps {
    teacherId: string;
    onClose: () => void;
}

export default function TeacherRegistration({ teacherId, onClose }: TeacherRegistrationProps) {
    const [teacher, setTeacher] = useState<any>(null);
    const [busySessions, setBusySessions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchTeacher = async () => {
            try {
                const res = await fetch(`${API_URL}/giao-vien/${teacherId}`);

                if (!res.ok) {
                    if (res.status === 404) {
                        console.error("Teacher not found");
                        setTeacher(null);
                        return;
                    }
                    throw new Error(`Error: ${res.status}`);
                }

                const data = await res.json();
                setTeacher(data);
                // Parse existing wish (assuming it's a JSON array of strings like "2_0", "3_1")
                // Format convention: "{Day}_{Session}" 
                // Day: 2-7
                // Session: 0 (Morning), 1 (Afternoon)
                // Example in DB might be "T2_S", "T2_C" or simple "2_0". 
                // Let's standardize on "Day_Session" e.g "2_0" for Monday Morning.

                // If DB has "T2_S", we need to map. For now assume clean state or simple string match.
                // Let's use simple integers: Day 2-7, Session 0-1.
                // Stored as "2_0", "2_1"

                let existing: string[] = [];
                if (Array.isArray(data.ngay_nghi_dang_ky)) {
                    existing = data.ngay_nghi_dang_ky;
                }
                setBusySessions(existing);
            } catch (error) {
                console.error("Failed to fetch teacher:", error);
                setTeacher(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTeacher();
    }, [teacherId]);

    const toggleSession = (day: number, session: number) => {
        const key = `${day}_${session}`;
        setBusySessions(prev => {
            if (prev.includes(key)) {
                return prev.filter(k => k !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch(`${API_URL}/giao-vien/${teacherId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ngay_nghi_dang_ky: busySessions
                })
            });
            alert("Đã lưu nguyện vọng thành công!");
            onClose();
        } catch (error) {
            console.error("Save failed:", error);
            alert("Lưu thất bại.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-4">Đang tải...</div>;
    if (!teacher) return <div className="p-4 text-red-500">Giáo viên không tồn tại</div>;

    const days = [2, 3, 4, 5, 6, 7];
    const sessions = [
        { id: 0, label: 'Sáng' },
        { id: 1, label: 'Chiều' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-700 text-lg">Đăng Ký Nguyện Vọng</h3>
                        <p className="text-sm text-slate-500">Giáo viên: <span className="font-semibold text-blue-600">{teacher.ho_ten}</span></p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100">
                        <strong>Hướng dẫn:</strong> Bấm vào các ô để đánh dấu là <span className="font-bold text-red-500">BẬN (Không dạy)</span>. Các ô trắng là có thể dạy bình thường.
                    </div>

                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 border border-gray-200 bg-slate-50 text-slate-600">Buổi / Thứ</th>
                                {days.map(day => (
                                    <th key={day} className="p-3 border border-gray-200 bg-slate-50 text-slate-600">Thứ {day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map(sess => (
                                <tr key={sess.id}>
                                    <td className="p-3 border border-gray-200 font-bold text-center text-slate-700 bg-slate-50">
                                        {sess.label}
                                    </td>
                                    {days.map(day => {
                                        const key = `${day}_${sess.id}`;
                                        const isBusy = busySessions.includes(key);
                                        return (
                                            <td
                                                key={key}
                                                onClick={() => toggleSession(day, sess.id)}
                                                className={`
                                                    p-3 border border-gray-200 text-center cursor-pointer transition-all hover:opacity-80
                                                    ${isBusy ? 'bg-red-500 text-white font-bold' : 'bg-white hover:bg-slate-50'}
                                                `}
                                            >
                                                {isBusy ? 'BẬN' : ''}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving && <span className="animate-spin text-white">⏳</span>}
                        {isSaving ? 'Đang lưu...' : 'Lưu Đăng Ký'}
                    </button>
                </div>
            </div>
        </div>
    );
}
