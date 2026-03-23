
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">
                        {initialData ? 'Update Class' : 'Add New Class'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                            <input className="w-full px-3 py-2 border rounded-lg"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. 10A1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                            <select className="w-full px-3 py-2 border rounded-lg"
                                value={formData.grade_level}
                                onChange={e => setFormData({ ...formData, grade_level: Number(e.target.value) })}
                            >
                                <option value={10}>Grade 10</option>
                                <option value={11}>Grade 11</option>
                                <option value={12}>Grade 12</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Main Session</label>
                            <select className="w-full px-3 py-2 border rounded-lg"
                                value={formData.main_session}
                                onChange={e => setFormData({ ...formData, main_session: Number(e.target.value) })}
                            >
                                <option value={0}>Morning</option>
                                <option value={1}>Afternoon</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Room</label>
                            <select className="w-full px-3 py-2 border rounded-lg"
                                value={formData.fixed_room_id}
                                onChange={e => setFormData({ ...formData, fixed_room_id: e.target.value })}
                            >
                                <option value="">-- No Fixed Room --</option>
                                {rooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Homeroom Teacher</label>
                        <select className="w-full px-3 py-2 border rounded-lg"
                            value={formData.homeroom_teacher_id}
                            onChange={e => setFormData({ ...formData, homeroom_teacher_id: e.target.value })}
                        >
                            <option value="">-- Select Teacher --</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-white flex items-center gap-2">
                            {isLoading && <span className="animate-spin text-white">⏳</span>}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
