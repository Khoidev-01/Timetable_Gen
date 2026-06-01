'use client';
import { useState } from 'react';
import { API_URL } from '@/lib/api';

export default function TeacherProfilePage() {
    const [formData, setFormData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);

    const inputCls = "w-full px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/auth/change-password`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Đổi mật khẩu thành công.' });
                setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setMessage({ type: 'error', text: data.message || 'Đã xảy ra lỗi.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Lỗi kết nối.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] border border-[var(--border-default)] overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4">
                <h1 className="text-lg font-bold text-white">Đổi mật khẩu</h1>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {message.text && (
                    <div className={`p-3 rounded-[var(--radius-md)] text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {message.text}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Mật khẩu hiện tại</label>
                    <input
                        type="password"
                        required
                        className={inputCls}
                        value={formData.oldPassword}
                        onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Mật khẩu mới</label>
                    <input
                        type="password"
                        required
                        className={inputCls}
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        placeholder="Tối thiểu 6 ký tự"
                        minLength={6}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Xác nhận mật khẩu mới</label>
                    <input
                        type="password"
                        required
                        className={inputCls}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="tactile w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-[var(--radius-md)] flex justify-center items-center gap-2 shadow-[var(--shadow-sm)] disabled:opacity-60"
                    >
                        {isLoading ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : 'Lưu thay đổi'}
                    </button>
                </div>
            </form>
        </div>
    );
}
