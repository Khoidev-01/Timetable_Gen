
'use client';
import { useState, useEffect } from 'react';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export default function AccountModal({ isOpen, onClose, onSave, initialData }: AccountModalProps) {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'TEACHER',
        teacher_profile_id: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                username: initialData.username,
                password: '', // Don't show password
                role: initialData.role,
                teacher_profile_id: initialData.teacher_profile_id || ''
            });
        } else {
            setFormData({
                username: '',
                password: '',
                role: 'TEACHER',
                teacher_profile_id: ''
            });
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
            alert('Lỗi khi lưu dữ liệu');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">
                        {initialData ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                        <input
                            type="text"
                            required
                            disabled={!!initialData} // Username usually immutable
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mật khẩu {initialData && <span className="text-gray-400 font-normal">(để trống để giữ nguyên)</span>}
                        </label>
                        <input
                            type="password"
                            required={!initialData}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                        <select
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="TEACHER">Giáo viên</option>
                            <option value="ADMIN">Quản trị viên (Admin)</option>
                        </select>
                    </div>

                    {formData.role === 'TEACHER' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên liên kết</label>
                            <TeacherSelect
                                value={formData.teacher_profile_id}
                                onChange={(val) => setFormData({ ...formData, teacher_profile_id: val })}
                            />
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                        >
                            {isLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Helper Component for Teacher Select
function TeacherSelect({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('http://localhost:4000/resources/teachers', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setTeachers(data);
                }
            } catch (error) {
                console.error("Failed to fetch teachers", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTeachers();
    }, []);

    if (loading) return <div className="text-sm text-gray-500">Đang tải danh sách giáo viên...</div>;

    return (
        <select
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={value}
            onChange={e => onChange(e.target.value)}
        >
            <option value="">-- Chọn giáo viên --</option>
            {teachers.map(t => (
                <option key={t.id} value={t.id}>
                    {t.full_name} ({t.code})
                </option>
            ))}
        </select>
    );
}
