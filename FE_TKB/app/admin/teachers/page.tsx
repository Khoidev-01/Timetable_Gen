'use client';

import Link from 'next/link';
import { toast } from '@/lib/toast';
import { useEffect, useMemo, useState } from 'react';
import TeacherModal from '../../components/admin/TeacherModal';
import { API_URL } from '@/lib/api';
import { TableSkeleton, EmptyState } from '../../components/ui/States';
import { GraduationCap } from 'lucide-react';
import Select, { SelectOption } from '../../components/ui/Select';
import { Pager, usePaged } from '../../components/ui/Paging';

const ALL_SUBJECTS = 'ALL';
const UNASSIGNED = 'NONE';

interface Teacher {
  id: string;
  code: string;
  full_name: string;
  email?: string;
  phone?: string;
  max_periods_per_week: number;
  /** Leo cầu thang nặng đến đâu với riêng người này, tính theo phần mười */
  mobility_weight?: number;
  homeroom_classes?: { id: string; name: string }[];
  /** Các môn đang dạy, lấy từ phân công giảng dạy. */
  teaching_subjects?: { id: number; code: string; name: string }[];
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>(ALL_SUBJECTS);

  // Môn lấy từ chính phân công của giáo viên; một người dạy nhiều môn thì có mặt ở mọi môn đó
  const subjectOptions = useMemo<SelectOption[]>(() => {
    const counts = new Map<string, { name: string; count: number }>();
    let unassigned = 0;
    for (const teacher of teachers) {
      const subjects = teacher.teaching_subjects ?? [];
      if (subjects.length === 0) unassigned++;
      for (const subject of subjects) {
        const key = String(subject.id);
        const entry = counts.get(key) ?? { name: subject.name, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
    }
    return [
      { value: ALL_SUBJECTS, label: `Tất cả môn (${teachers.length})` },
      ...[...counts.entries()]
        .sort((a, b) => a[1].name.localeCompare(b[1].name, 'vi'))
        .map(([value, entry]) => ({ value, label: `${entry.name} (${entry.count})` })),
      ...(unassigned > 0 ? [{ value: UNASSIGNED, label: `Chưa phân công (${unassigned})` }] : []),
    ];
  }, [teachers]);

  const activeSubject = subjectOptions.some((option) => option.value === subjectFilter) ? subjectFilter : ALL_SUBJECTS;
  const filteredTeachers = useMemo(() => {
    if (activeSubject === ALL_SUBJECTS) return teachers;
    if (activeSubject === UNASSIGNED) return teachers.filter((t) => (t.teaching_subjects ?? []).length === 0);
    return teachers.filter((t) => (t.teaching_subjects ?? []).some((subject) => String(subject.id) === activeSubject));
  }, [teachers, activeSubject]);
  const paged = usePaged(filteredTeachers);

  const fetchTeachers = async () => {
    try {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) return;

      setToken(currentToken);
      const response = await fetch(`${API_URL}/resources/teachers`, {
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
      const response = await fetch(`${API_URL}/resources/teachers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchTeachers();
      } else {
        toast('Xóa giáo viên thất bại.', "error");
      }
    } catch (error) {
      toast('Lỗi kết nối khi xóa giáo viên.', "error");
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Xóa TOÀN BỘ ${teachers.length} giáo viên cùng phân công và TKB liên quan? Hành động này không thể hoàn tác.`)) return;
    if (!confirm('Xác nhận lần cuối - bạn chắc chắn muốn xóa hết?')) return;
    try {
      const res = await fetch(`${API_URL}/resources/teachers/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { fetchTeachers(); toast('Đã xóa toàn bộ giáo viên.', "success"); }
      else toast('Lỗi khi xóa toàn bộ.', "error");
    } catch (e) {
      toast('Lỗi khi xóa toàn bộ.', "error");
    }
  };

  const handleSave = async (data: any) => {
    try {
      const url = editingTeacher
        ? `${API_URL}/resources/teachers/${editingTeacher.id}`
        : `${API_URL}/resources/teachers`;
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
      toast(error.message, "error");
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý giáo viên</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDeleteAll}
            disabled={teachers.length === 0}
            className="rounded-lg border border-red-600 px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Xóa toàn bộ
          </button>
          <Link
            href="/admin/assignments"
            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            Nhập Excel tại Phân công
          </Link>
          <button
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-hover)]"
            onClick={() => {
              setEditingTeacher(null);
              setIsModalOpen(true);
            }}
          >
            Thêm giáo viên
          </button>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
        File Excel nhập tổng năm học được xử lý tại trang <b>Phân công chuyên môn</b> để đồng bộ
        giáo viên, lớp, tổ hợp và phân công cho cả hai học kỳ.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-[var(--text-secondary)]">Môn dạy</span>
        <Select
          className="w-72"
          value={activeSubject}
          options={subjectOptions}
          onChange={(value) => {
            setSubjectFilter(value);
            paged.setPage(1);
          }}
          searchable
          searchPlaceholder="Tìm môn..."
          aria-label="Lọc giáo viên theo môn dạy"
        />
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
        <table className="data-table w-full border-collapse text-left">
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-surface-hover)] text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-6 py-3 text-center">Mã GV</th>
              <th className="px-6 py-3 text-center">Họ và tên</th>
              <th className="px-6 py-3 text-center">Môn dạy</th>
              <th className="px-6 py-3 text-center">Chủ nhiệm</th>
              <th className="px-6 py-3 text-center">Liên hệ</th>
              <th className="px-6 py-3 text-center">Số tiết tối đa / tuần</th>
              <th className="px-6 py-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-secondary)]">
            {isLoading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : teachers.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<GraduationCap size={22} strokeWidth={1.8} />}
                    title="Chưa có giáo viên nào"
                    hint="Thêm thủ công hoặc nhập danh sách từ Excel ở trang Phân công."
                  />
                </td>
              </tr>
            ) : filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<GraduationCap size={22} strokeWidth={1.8} />}
                    title="Không có giáo viên nào dạy môn này"
                    hint="Chọn môn khác hoặc Tất cả môn."
                  />
                </td>
              </tr>
            ) : (
              paged.visible.map((teacher, idx) => (
                <tr key={teacher.id} style={{ animationDelay: `${idx * 30}ms` }} className="animate-rise hover:bg-[var(--bg-surface-hover)] transition-colors">
                  <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{teacher.code}</td>
                  <td className="px-6 py-4 font-medium">{teacher.full_name}</td>
                  <td className="px-6 py-4 text-sm">
                    {teacher.teaching_subjects && teacher.teaching_subjects.length > 0 ? (
                      teacher.teaching_subjects.map((subject) => subject.name).join(', ')
                    ) : (
                      <span className="text-[var(--text-muted)]">Chưa phân công</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {teacher.homeroom_classes && teacher.homeroom_classes.length > 0 ? (
                      teacher.homeroom_classes.map(c => c.name).join(', ')
                    ) : (
                      <span className="text-[var(--text-muted)]">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-[var(--text-primary)]">{teacher.phone || '--'}</div>
                    <div className="text-[var(--text-muted)]">{teacher.email || '--'}</div>
                  </td>
                  <td className="px-6 py-4">{teacher.max_periods_per_week}</td>
                  <td className="px-6 py-4 text-right">
                    <button type="button"
                      className="row-action"
                      onClick={() => {
                        setEditingTeacher(teacher);
                        setIsModalOpen(true);
                      }}
                    >
                      Sửa
                    </button>
                    <button type="button"
                      className="row-action row-action--danger"
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
        {!isLoading && <Pager paged={paged} noun="giáo viên" label="Phân trang giáo viên" />}
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
