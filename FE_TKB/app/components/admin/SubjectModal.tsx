
'use client';
import { useState, useEffect } from 'react';

interface SubjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export default function SubjectModal({ isOpen, onClose, onSave, initialData }: SubjectModalProps) {
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        color: '#3b82f6', // Default blue
        is_special: false
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                code: initialData.code,
                name: initialData.name,
                color: initialData.color || '#3b82f6',
                is_special: initialData.is_special || false
            });
        } else {
            setFormData({ code: '', name: '', color: '#3b82f6', is_special: false });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            // Handled by parent
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] w-full max-w-md overflow-hidden animate-rise">
                <div className="px-6 py-4 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-surface-hover)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {initialData ? 'Sửa môn học' : 'Thêm môn học'}
                    </h3>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Mã môn</label>
                        <input className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                            required
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            placeholder="VD: TOAN"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tên môn</label>
                        <input className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 outline-none transition-all"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="VD: Toán"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="is_special"
                            className="w-4 h-4 text-[var(--accent)] rounded"
                            checked={formData.is_special}
                            onChange={e => setFormData({ ...formData, is_special: e.target.checked })}
                        />
                        <label htmlFor="is_special" className="text-sm font-medium text-[var(--text-secondary)]">Môn đặc biệt (Chào cờ, Sinh hoạt...)</label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Màu hiển thị</label>
                        <div className="flex gap-2 items-center">
                            <input type="color" className="h-10 w-20 border rounded cursor-pointer"
                                value={formData.color}
                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                            />
                            <span className="text-sm text-[var(--text-muted)]">{formData.color}</span>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border-light)] mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-[var(--bg-surface-hover)] rounded-[var(--radius-md)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] font-medium tactile">Hủy</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-[var(--accent)] rounded-[var(--radius-md)] hover:bg-[var(--accent-hover)] tactile text-[var(--accent-contrast)] font-semibold flex items-center gap-2 disabled:opacity-60">
                            {isLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                            {initialData ? "Lưu thay đổi" : "Tạo môn"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
