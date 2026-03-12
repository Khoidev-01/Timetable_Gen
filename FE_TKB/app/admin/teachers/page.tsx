'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
      const currentToken = localStorage.getItem('token');
      if (!currentToken) return;

      setToken(currentToken);
      const response = await fetch('http://localhost:4000/resources/teachers', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (response.ok) {
        setTeachers(await response.json());
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
    if (!confirm('Bạn có chắc muốn xóa giáo viên này?')) return;

    try {
      const response = await fetch(`http://localhost:4000/resources/teachers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchTeachers();
      } else {
        alert('Xóa giáo viên thất bại.');
      }
    } catch (error) {
      alert('Lỗi kết nối khi xóa giáo viên.');
    }
  };

  const handleSave = async (data: any) => {
    try {
      const url = editingTeacher
        ? `http://localhost:4000/resources/teachers/${editingTeacher.id}`
        : 'http://localhost:4000/resources/teachers';
      const method = editingTeacher ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || 'Không thể lưu giáo viên.');
      }

      fetchTeachers();
    } catch (error: any) {
      alert(error.message);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý giáo viên</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/assignments"
            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Nhập Excel tại Phân công
          </Link>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={() => {
              setEditingTeacher(null);
              setIsModalOpen(true);
            }}
          >
            Thêm giáo viên
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        File Excel nhập tổng năm học được xử lý tại trang <b>Phân công chuyên môn</b> để đồng bộ
        giáo viên, lớp, tổ hợp và phân công cho cả hai học kỳ.
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-gray-200 bg-gray-50 font-semibold text-gray-900">
            <tr>
              <th className="px-6 py-4">Mã GV</th>
              <th className="px-6 py-4">Họ và tên</th>
              <th className="px-6 py-4">Liên hệ</th>
              <th className="px-6 py-4">Số tiết tối đa / tuần</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-600">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : teachers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  Chưa có giáo viên nào
                </td>
              </tr>
            ) : (
              teachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{teacher.code}</td>
                  <td className="px-6 py-4 font-medium">{teacher.full_name}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-gray-900">{teacher.email || '--'}</div>
                    <div className="text-gray-500">{teacher.phone || '--'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                      {teacher.max_periods_per_week}
                    </span>
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    <button
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        setEditingTeacher(teacher);
                        setIsModalOpen(true);
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                      onClick={() => handleDelete(teacher.id)}
                    >
                      Xóa
                    </button>
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
