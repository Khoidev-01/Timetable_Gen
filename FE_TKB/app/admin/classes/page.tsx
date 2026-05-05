'use client';
import { useState, useEffect } from 'react';
import ClassModal from '../../components/admin/ClassModal';
import { API_URL } from '@/lib/api';

interface ClassData {
    id: string;
    name: string;
    grade_level: number;
    main_session: number; // 0: Morning, 1: Afternoon
    fixed_room?: { name: string };
    homeroom_teacher?: { full_name: string };
}

export default function ClassesPage() {
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ClassData | null>(null);

    const fetchClasses = async () => {
        try {
            const t = localStorage.getItem('token');
            if (!t) return;
            setToken(t);

            const res = await fetch(`${API_URL}/organization/classes`, {
                headers: { Authorization: `Bearer ${t}` }
            });
            if (res.ok) {
                const data = await res.json();
                setClasses(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClasses();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa lớp này?')) return;
        try {
            const res = await fetch(`${API_URL}/organization/classes/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchClasses();
            else alert('Xóa thất bại');
        } catch (e) {
            alert('Lỗi khi xóa');
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm(`Xóa TOÀN BỘ ${classes.length} lớp học cùng phân công và TKB liên quan? Hành động này không thể hoàn tác.`)) return;
        if (!confirm('Xác nhận lần cuối — bạn chắc chắn muốn xóa hết?')) return;
        try {
            const res = await fetch(`${API_URL}/organization/classes/all`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) { fetchClasses(); alert('Đã xóa toàn bộ lớp học.'); }
            else alert('Lỗi khi xóa toàn bộ.');
        } catch (e) {
            alert('Lỗi khi xóa toàn bộ.');
        }
    };

    const handleSave = async (data: any) => {
        try {
            const url = editingClass
                ? `${API_URL}/organization/classes/${editingClass.id}`
                : `${API_URL}/organization/classes`;
            const method = editingClass ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Lỗi khi lưu dữ liệu');
            }
            fetchClasses();
        } catch (e: any) {
            alert(e.message);
            throw e;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý Lớp học</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleDeleteAll}
                        disabled={classes.length === 0}
                        className="border border-red-600 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Xóa toàn bộ
                    </button>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        onClick={() => { setEditingClass(null); setIsModalOpen(true); }}
                    >
                        <span>➕</span> Thêm lớp học
                    </button>
                </div>
            </div>

            <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-default)] overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold border-b border-[var(--border-default)]">
                        <tr>
                            <th className="px-6 py-4">Tên lớp</th>
                            <th className="px-6 py-4">Khối</th>
                            <th className="px-6 py-4">Buổi</th>
                            <th className="px-6 py-4">Phòng học cố định</th>
                            <th className="px-6 py-4">GV Chủ nhiệm</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-[var(--text-secondary)] divide-y divide-[var(--border-light)]">
                        {isLoading ? (
                            <tr><td colSpan={6} className="text-center py-8">Đang tải...</td></tr>
                        ) : classes.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8">Chưa có lớp học nào</td></tr>
                        ) : (
                            classes.map(cls => (
                                <tr key={cls.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                                    <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{cls.name}</td>
                                    <td className="px-6 py-4"><span className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] px-2 py-1 rounded text-xs font-bold">{cls.grade_level}</span></td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${cls.main_session === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {cls.main_session === 0 ? 'Sáng' : 'Chiều'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {cls.fixed_room ? cls.fixed_room.name : <span className="text-gray-400 italic">--</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {cls.homeroom_teacher ? cls.homeroom_teacher.full_name : <span className="text-gray-400 italic">--</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            onClick={() => { setEditingClass(cls); setIsModalOpen(true); }}
                                        >Sửa</button>
                                        <button className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            onClick={() => handleDelete(cls.id)}
                                        >Xóa</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ClassModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingClass}
            />
        </div>
    );
}
