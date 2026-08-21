
'use client';
import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

interface ClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export default function ClassModal({ isOpen, onClose, onSave, initialData }: ClassModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        grade_level: 10,
        main_session: 0, // 0: Morning, 1: Afternoon
        fixed_room_id: '',
        homeroom_teacher_id: ''
    });

    const [rooms, setRooms] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch dropdown data
    useEffect(() => {
        if (!isOpen) return;
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [roomsRes, teachersRes] = await Promise.all([
                fetch(`${API_URL}/resources/rooms`, { headers }),
                fetch(`${API_URL}/resources/teachers`, { headers })
            ]);

            if (roomsRes.ok) setRooms(await roomsRes.json());
            if (teachersRes.ok) setTeachers(await teachersRes.json());
        };
        fetchData();

        // Reset or Fill Form
        if (initialData) {
            setFormData({
                name: initialData.name,
                grade_level: initialData.grade_level,
                main_session: initialData.main_session,
                fixed_room_id: initialData.fixed_room_id || '',
                homeroom_teacher_id: initialData.homeroom_teacher_id || ''
            });
        } else {
            // Defaults
            setFormData({
                name: '',
                grade_level: 10,
                main_session: 0,
                fixed_room_id: '',
                homeroom_teacher_id: ''
            });
        }
    }, [isOpen, initialData]);


    if (!isOpen) return null;

    const inputCls = "w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Convert types if needed
            const payload = {
                ...formData,
                grade_level: Number(formData.grade_level),
                main_session: Number(formData.main_session),
                fixed_room_id: formData.fixed_room_id ? Number(formData.fixed_room_id) : null,
                homeroom_teacher_id: formData.homeroom_teacher_id || null
            };
            await onSave(payload);
            onClose();
        } catch (error) {
            // Handled by parent
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-lg overflow-hidden animate-rise">
                <div className="px-6 py-4 border-b border-[var(--border-default)] flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {initialData ? 'Sửa lớp học' : 'Thêm lớp học'}
                    </h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Tên lớp</label>
                            <input className={inputCls}
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="VD: 10A1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Khối</label>
                            <select className={inputCls}
                                value={formData.grade_level}
                                onChange={e => setFormData({ ...formData, grade_level: Number(e.target.value) })}
                            >
                                <option value={10}>Khối 10</option>
                                <option value={11}>Khối 11</option>
                                <option value={12}>Khối 12</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Buổi học chính</label>
                            <select className={inputCls}
                                value={formData.main_session}
                                onChange={e => setFormData({ ...formData, main_session: Number(e.target.value) })}
                            >
                                <option value={0}>Sáng</option>
                                <option value={1}>Chiều</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Phòng cố định</label>
                            <select className={inputCls}
                                value={formData.fixed_room_id}
                                onChange={e => setFormData({ ...formData, fixed_room_id: e.target.value })}
                            >
                                <option value="">Không có phòng cố định</option>
                                {rooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Giáo viên chủ nhiệm</label>
                        <select className={inputCls}
                            value={formData.homeroom_teacher_id}
                            onChange={e => setFormData({ ...formData, homeroom_teacher_id: e.target.value })}
                        >
                            <option value="">Chọn giáo viên</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border-default)] mt-4">
                        <button type="button" onClick={onClose} className="tactile px-4 py-2 bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] font-medium">Hủy</button>
                        <button type="submit" disabled={isLoading} className="tactile px-4 py-2 bg-[var(--accent)] rounded-[var(--radius-md)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] font-semibold flex items-center gap-2 disabled:opacity-60">
                            {isLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                            {initialData ? 'Lưu thay đổi' : 'Tạo lớp'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
