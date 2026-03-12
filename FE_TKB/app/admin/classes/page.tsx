'use client';
import { useState, useEffect } from 'react';
import ClassModal from '../../components/admin/ClassModal';

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

            const res = await fetch('http://localhost:4000/organization/classes', {
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
            const res = await fetch(`http://localhost:4000/organization/classes/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchClasses();
            else alert('Xóa thất bại');
        } catch (e) {
            alert('Lỗi khi xóa');
        }
    };

    const handleSave = async (data: any) => {
        try {
            const url = editingClass
                ? `http://localhost:4000/organization/classes/${editingClass.id}`
                : 'http://localhost:4000/organization/classes';
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
                <h1 className="text-2xl font-bold text-gray-800">Quản lý Lớp học</h1>
                <button
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    onClick={() => { setEditingClass(null); setIsModalOpen(true); }}
                >
                    <span>➕</span> Thêm lớp học
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Tên lớp</th>
                            <th className="px-6 py-4">Khối</th>
                            <th className="px-6 py-4">Buổi</th>
                            <th className="px-6 py-4">Phòng học cố định</th>
                            <th className="px-6 py-4">GV Chủ nhiệm</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-600 divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={6} className="text-center py-8">Đang tải...</td></tr>
                        ) : classes.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8">Chưa có lớp học nào</td></tr>
                        ) : (
                            classes.map(cls => (
                                <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{cls.name}</td>
                                    <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{cls.grade_level}</span></td>
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
