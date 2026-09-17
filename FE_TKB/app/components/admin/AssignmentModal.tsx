'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import Select from '@/app/components/ui/Select';

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
      <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--border-light)] bg-[var(--bg-surface-hover)] px-6 py-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {initialData ? 'Cập nhật phân công' : 'Thêm phân công'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-[var(--text-secondary)]">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Giáo viên</label>
            <Select
              size="sm"
              required
              value={formData.teacher_id}
              onChange={(teacher_id) => setFormData({ ...formData, teacher_id })}
              placeholder="Chọn giáo viên"
              searchPlaceholder="Tìm tên hoặc mã giáo viên..."
              options={teachers.map((teacher) => ({ value: String(teacher.id), label: `${teacher.full_name} (${teacher.code})` }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Lớp</label>
              <Select
                size="sm"
                required
                value={formData.class_id}
                onChange={(class_id) => setFormData({ ...formData, class_id })}
                placeholder="Chọn lớp"
                searchPlaceholder="Tìm lớp..."
                options={classes.map((currentClass) => ({ value: String(currentClass.id), label: currentClass.name }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Môn học</label>
              <Select
                size="sm"
                required
                value={formData.subject_id}
                onChange={(subject_id) => setFormData({ ...formData, subject_id })}
                placeholder="Chọn môn"
                searchPlaceholder="Tìm tên hoặc mã môn..."
                options={subjects.map((subject) => ({ value: String(subject.id), label: `${subject.name} (${subject.code})` }))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Số tiết / tuần</label>
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

          <div className="mt-4 flex justify-end gap-3 border-t border-[var(--border-light)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[var(--bg-surface-hover)] px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--border-default)]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-hover)]"
            >
              {isLoading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
