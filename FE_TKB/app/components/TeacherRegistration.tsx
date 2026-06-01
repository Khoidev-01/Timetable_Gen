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
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

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
        setMessage(null);
        try {
            const res = await fetch(`${API_URL}/giao-vien/${teacherId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ngay_nghi_dang_ky: busySessions
                })
            });
            if (!res.ok) throw new Error('save failed');
            setMessage({ text: 'Đã lưu nguyện vọng thành công.', ok: true });
            setTimeout(onClose, 800);
        } catch (error) {
            console.error("Save failed:", error);
            setMessage({ text: 'Lưu thất bại. Vui lòng thử lại.', ok: false });
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
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-surface-hover)] shrink-0">
                    <div>
                        <h3 className="font-bold text-[var(--text-primary)] text-lg">Đăng Ký Nguyện Vọng</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Giáo viên: <span className="font-semibold text-emerald-600">{teacher.ho_ten}</span></p>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="mb-4 p-3 bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] rounded-[var(--radius-md)] text-sm border border-[var(--border-default)]">
                        <strong className="text-[var(--text-primary)]">Hướng dẫn:</strong> Bấm vào các ô để đánh dấu là <span className="font-bold text-red-500">BẬN (Không dạy)</span>. Các ô trống là có thể dạy bình thường.
                    </div>

                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 border border-[var(--border-default)] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">Buổi / Thứ</th>
                                {days.map(day => (
                                    <th key={day} className="p-3 border border-[var(--border-default)] bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">Thứ {day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map(sess => (
                                <tr key={sess.id}>
                                    <td className="p-3 border border-[var(--border-default)] font-bold text-center text-[var(--text-primary)] bg-[var(--bg-surface-hover)]">
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
                                                    p-3 border border-[var(--border-default)] text-center cursor-pointer transition-all hover:opacity-80
                                                    ${isBusy ? 'bg-red-500 text-white font-bold' : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'}
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

                {message && (
                    <div className={`mx-6 mb-1 rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-medium border
                        ${message.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {message.text}
                    </div>
                )}
                <div className="px-6 py-4 bg-[var(--bg-surface-hover)] border-t border-[var(--border-default)] flex justify-end gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--border-default)] rounded-[var(--radius-md)] transition-all"
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
