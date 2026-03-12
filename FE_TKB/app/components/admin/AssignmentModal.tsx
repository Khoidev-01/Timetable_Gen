
'use client';
import { useState, useEffect } from 'react';

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export default function AssignmentModal({ isOpen, onClose, onSave, initialData }: AssignmentModalProps) {
    const [formData, setFormData] = useState({
        teacher_id: '',
        class_id: '',
        subject_id: '',
        total_periods: 2
    });

    const [teachers, setTeachers] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [tRes, cRes, sRes] = await Promise.all([
                fetch('http://localhost:4000/resources/teachers', { headers }),
                fetch('http://localhost:4000/organization/classes', { headers }),
                fetch('http://localhost:4000/resources/subjects', { headers })
            ]);

            if (tRes.ok) setTeachers(await tRes.json());
            if (cRes.ok) setClasses(await cRes.json());
            if (sRes.ok) setSubjects(await sRes.json());
        };
        fetchData();

        if (initialData) {
            setFormData({
                teacher_id: initialData.teacher_id,
                class_id: initialData.class_id,
                subject_id: initialData.subject_id,
                total_periods: initialData.total_periods || 2
            });
        } else {
            setFormData({
                teacher_id: '', class_id: '', subject_id: '',
                total_periods: 2
            });
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                total_periods: Number(formData.total_periods),
                subject_id: Number(formData.subject_id)
            });
            // subject_id is Int in BE, class_id/teacher_id string
            onClose();
        } catch (error) {
            // Handled parent
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">
                        {initialData ? 'Update Assignment' : 'New Assignment'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                        <select className="w-full px-3 py-2 border rounded-lg"
                            required
                            value={formData.teacher_id}
                            onChange={e => setFormData({ ...formData, teacher_id: e.target.value })}
                        >
                            <option value="">-- Select Teacher --</option>
                            {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                            <select className="w-full px-3 py-2 border rounded-lg"
                                required
                                value={formData.class_id}
                                onChange={e => setFormData({ ...formData, class_id: e.target.value })}
                            >
                                <option value="">-- Select Class --</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                            <select className="w-full px-3 py-2 border rounded-lg"
                                required
                                value={formData.subject_id}
                                onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                            >
                                <option value="">-- Select Subject --</option>
                                {subjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Periods / Week</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg"
                            min={1}
                            value={formData.total_periods}
                            onChange={e => setFormData({ ...formData, total_periods: Number(e.target.value) })}
                        />
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
