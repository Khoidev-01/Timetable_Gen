'use client';
import { useState, useEffect } from 'react';
import TeacherModal from '../../components/admin/TeacherModal';

interface Teacher {
    id: string;
    code: string;
    full_name: string;
    email?: string;
    phone?: string;
    max_periods_per_week: number;
}

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

    const fetchTeachers = async () => {
        try {
            const t = localStorage.getItem('token');
            if (!t) return;
            setToken(t);

            const res = await fetch('http://localhost:4000/resources/teachers', {
                headers: { Authorization: `Bearer ${t}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTeachers(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa giáo viên này?')) return;
        try {
            const res = await fetch(`http://localhost:4000/resources/teachers/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchTeachers();
            else alert('Xóa thất bại');
        } catch (e) {
            alert('Lỗi khi xóa');
        }
    };

    const handleSave = async (data: any) => {
        try {
            const url = editingTeacher
                ? `http://localhost:4000/resources/teachers/${editingTeacher.id}`
                : 'http://localhost:4000/resources/teachers';
            const method = editingTeacher ? 'PUT' : 'POST';

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
            fetchTeachers();
        } catch (e: any) {
            alert(e.message);
            throw e;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Quản lý Giáo viên</h1>
                <div className="flex gap-2">
                    <button
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        onClick={() => alert("Tính năng Import Excel đang phát triển")}
                    >
                        <span>📥</span> Nhập Excel
                    </button>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        onClick={() => { setEditingTeacher(null); setIsModalOpen(true); }}
                    >
                        <span>➕</span> Thêm giáo viên
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Mã GV</th>
                            <th className="px-6 py-4">Họ và tên</th>
                            <th className="px-6 py-4">Liên hệ</th>
                            <th className="px-6 py-4">Số tiết tối đa/Tuần</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-600 divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-8">Đang tải...</td></tr>
                        ) : teachers.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8">Chưa có giáo viên nào</td></tr>
                        ) : (
                            teachers.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{t.code}</td>
                                    <td className="px-6 py-4 font-medium">{t.full_name}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <div className="text-gray-900">{t.email || '--'}</div>
                                        <div className="text-gray-500">{t.phone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                                            {t.max_periods_per_week}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            onClick={() => { setEditingTeacher(t); setIsModalOpen(true); }}
                                        >Sửa</button>
                                        <button className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            onClick={() => handleDelete(t.id)}
                                        >Xóa</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <TeacherModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingTeacher}
            />
        </div>
    );
}
