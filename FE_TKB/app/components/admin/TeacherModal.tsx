
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
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-2xl overflow-hidden animate-rise">
                <div className="px-6 py-4 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-surface-hover)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {initialData ? 'Sửa giáo viên' : 'Thêm giáo viên'}
                    </h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Mã giáo viên</label>
                            <input className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                placeholder="Tự sinh nếu để trống"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Họ và tên *</label>
                            <input className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                                required
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
                            <input type="email" className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Số điện thoại</label>
                            <input className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Số tiết tối đa / tuần</label>
                        <input type="number" className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                            value={formData.max_periods_per_week}
                            onChange={e => setFormData({ ...formData, max_periods_per_week: Number(e.target.value) })}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border-default)] mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] font-medium tactile">Hủy</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-[var(--accent)] rounded-[var(--radius-md)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] font-semibold flex items-center gap-2 disabled:opacity-60 tactile">
                            {isLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                            {initialData ? "Lưu thay đổi" : "Tạo giáo viên"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
