
'use client';
import { useState, useEffect } from 'react';

interface TeacherModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export default function TeacherModal({ isOpen, onClose, onSave, initialData }: TeacherModalProps) {
    const [formData, setFormData] = useState({
        code: '',
        full_name: '',
        email: '',
        phone: '',
        max_periods_per_week: 20
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                code: initialData.code || '',
                full_name: initialData.full_name || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                max_periods_per_week: initialData.max_periods_per_week || 20
            });
        } else {
            setFormData({
                code: '',
                full_name: '',
                email: '',
                phone: '',
                max_periods_per_week: 20
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                ...formData,
                max_periods_per_week: Number(formData.max_periods_per_week)
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-surface-hover)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {initialData ? 'Update Teacher' : 'Add New Teacher'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-[var(--text-secondary)]">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Teacher Code</label>
                            <input className="w-full px-3 py-2 border rounded-lg"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                placeholder="Auto-generated if empty"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Full Name *</label>
                            <input className="w-full px-3 py-2 border rounded-lg"
                                required
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
                            <input type="email" className="w-full px-3 py-2 border rounded-lg"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phone Number</label>
                            <input className="w-full px-3 py-2 border rounded-lg"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Max Periods / Week</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg"
                            value={formData.max_periods_per_week}
                            onChange={e => setFormData({ ...formData, max_periods_per_week: Number(e.target.value) })}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border-light)] mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-[var(--bg-surface-hover)] rounded-lg hover:bg-gray-200 text-[var(--text-secondary)]">Cancel</button>
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
