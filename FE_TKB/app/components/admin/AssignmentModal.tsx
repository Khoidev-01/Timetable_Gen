'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export default function AssignmentModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: AssignmentModalProps) {
  const [formData, setFormData] = useState({
    teacher_id: '',
    class_id: '',
    subject_id: '',
    total_periods: 2,
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

      const [teacherRes, classRes, subjectRes] = await Promise.all([
        fetch(`${API_URL}/resources/teachers`, { headers }),
        fetch(`${API_URL}/organization/classes`, { headers }),
        fetch(`${API_URL}/resources/subjects`, { headers }),
      ]);

      if (teacherRes.ok) setTeachers(await teacherRes.json());
      if (classRes.ok) setClasses(await classRes.json());
      if (subjectRes.ok) setSubjects(await subjectRes.json());
    };

    fetchData();

    if (initialData) {
      setFormData({
        teacher_id: initialData.teacher_id ?? initialData.teacher?.id ?? '',
        class_id: initialData.class_id ?? initialData.class?.id ?? '',
        subject_id: String(initialData.subject_id ?? initialData.subject?.id ?? ''),
        total_periods: initialData.total_periods || 2,
      });
    } else {
      setFormData({
        teacher_id: '',
        class_id: '',
        subject_id: '',
        total_periods: 2,
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const teacher = teachers.find((item) => item.id === formData.teacher_id);
      const currentClass = classes.find((item) => item.id === formData.class_id);
      const subject = subjects.find((item) => String(item.id) === String(formData.subject_id));

      await onSave({
        ...formData,
        subject_id: Number(formData.subject_id),
        total_periods: Number(formData.total_periods),
        teacher,
        class: currentClass,
        subject,
      });
      onClose();
    } catch (error) {
      return;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-800">
            {initialData ? 'Cập nhật phân công' : 'Thêm phân công'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Giáo viên</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              required
              value={formData.teacher_id}
              onChange={(event) => setFormData({ ...formData, teacher_id: event.target.value })}
            >
              <option value="">-- Chọn giáo viên --</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name} ({teacher.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Lớp</label>
              <select
                className="w-full rounded-lg border px-3 py-2"
                required
                value={formData.class_id}
                onChange={(event) => setFormData({ ...formData, class_id: event.target.value })}
              >
                <option value="">-- Chọn lớp --</option>
                {classes.map((currentClass) => (
                  <option key={currentClass.id} value={currentClass.id}>
                    {currentClass.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Môn học</label>
              <select
                className="w-full rounded-lg border px-3 py-2"
                required
                value={formData.subject_id}
                onChange={(event) => setFormData({ ...formData, subject_id: event.target.value })}
              >
                <option value="">-- Chọn môn --</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Số tiết / tuần</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border px-3 py-2"
              value={formData.total_periods}
              onChange={(event) =>
                setFormData({ ...formData, total_periods: Number(event.target.value) })
              }
            />
          </div>

          <div className="mt-4 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {isLoading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
