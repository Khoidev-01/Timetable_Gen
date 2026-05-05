'use client';

import { useEffect, useRef, useState } from 'react';
import AssignmentModal from '../../components/admin/AssignmentModal';
import { API_URL } from '@/lib/api';

interface Semester {
  id: string;
  name: string;
  is_current: boolean;
}

interface SchoolYear {
  id: string;
  name: string;
  is_active: boolean;
  semesters: Semester[];
}

interface Assignment {
  id: string;
  teacher_id?: string;
  class_id?: string;
  subject_id?: number;
  teacher: { id?: string; full_name: string; code: string };
  class: { id?: string; name: string };
  subject: { id?: number; name: string; code: string };
  total_periods: number;
  period_type?: string;
  isNew?: boolean;
  isModified?: boolean;
}

interface ImportResult {
  summary: {
    subjects: { upserted: number };
    teachers: { created: number; updated: number };
    classes: { created: number; updated: number };
    combinations: { replaced: number };
    assignments: { deleted: number; created: number };
  } | null;
  warnings: Array<{ message: string; sheet: string; row: number; column: string }>;
  errors: Array<{ message: string; sheet: string; row: number; column: string }>;
  isError: boolean;
}

function getFileNameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = disposition.match(/filename="([^"]+)"/i);
  return plainMatch?.[1] ?? fallback;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [newYearEnd, setNewYearEnd] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Auto-assign state
  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoAssignFileRef = useRef<HTMLInputElement | null>(null);

  const fetchYears = async (preferredYearId?: string, preferredSemesterId?: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/system/years`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data: SchoolYear[] = await response.json();
      setYears(data);

      const year =
        data.find((item) => item.id === preferredYearId) ||
        data.find((item) => item.is_active) ||
        data[0];
      const semester =
        year?.semesters.find((item) => item.id === preferredSemesterId) || year?.semesters[0];

      setSelectedYearId(year?.id ?? '');
      setSelectedSemesterId(semester?.id ?? '');
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAssignments = async (semesterId = selectedSemesterId) => {
    if (!semesterId) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/assignments?semester_id=${semesterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      setAssignments(data);
      setDeletedIds([]);
      setIsDirty(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (selectedSemesterId) {
      fetchAssignments(selectedSemesterId);
    }
  }, [selectedSemesterId]);

  const parseDDMMYYYY = (value: string): Date | null => {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(date.getTime())) return null;
    return date;
  };

  const formatDateInput = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const validateDateInput = (value: string): string => {
    if (!value || value.length < 10) return '';
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return 'Sai định dạng. Nhập dd/mm/yyyy';
    const [, dd, mm, yyyy] = match;
    const day = Number(dd);
    const month = Number(mm);
    const year = Number(yyyy);
    if (month < 1 || month > 12) return `Tháng ${mm} không hợp lệ (01-12)`;
    if (year < 2000 || year > 2100) return `Năm ${yyyy} không hợp lệ`;
    const maxDay = new Date(year, month, 0).getDate();
    if (day < 1 || day > maxDay) return `Ngày ${dd} không hợp lệ (tháng ${mm} có ${maxDay} ngày)`;
    return '';
  };

  const startError = validateDateInput(newYearStart);
  const endError = validateDateInput(newYearEnd);

  const handleCreateYear = async (event: React.FormEvent) => {
    event.preventDefault();

    const startDate = parseDDMMYYYY(newYearStart);
    const endDate = parseDDMMYYYY(newYearEnd);
    if (!startDate || !endDate) {
      alert('Ngày không hợp lệ. Vui lòng nhập đúng định dạng dd/mm/yyyy.');
      return;
    }
    if (endDate <= startDate) {
      alert('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/system/years`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newYearName,
          start_date: startDate,
          end_date: endDate,
          status: 'ACTIVE',
        }),
      });

      if (!response.ok) {
        alert('Không thể tạo năm học.');
        return;
      }

      setIsYearModalOpen(false);
      setNewYearName('');
      setNewYearStart('');
      setNewYearEnd('');
      await fetchYears();
    } catch (error) {
      alert('Lỗi kết nối khi tạo năm học.');
    }
  };

  const handleLocalSave = async (data: any) => {
    setIsDirty(true);

    if (editingAssignment) {
      setAssignments((previous) =>
        previous.map((item) =>
          item.id === editingAssignment.id
            ? {
                ...item,
                ...data,
                teacher_id: data.teacher_id,
                class_id: data.class_id,
                subject_id: data.subject_id,
                teacher: data.teacher ?? item.teacher,
                class: data.class ?? item.class,
                subject: data.subject ?? item.subject,
                isModified: !item.isNew,
              }
            : item,
        ),
      );
    } else {
      const tempId = `temp-${Date.now()}`;
      setAssignments((previous) => [
        {
          id: tempId,
          teacher_id: data.teacher_id,
          class_id: data.class_id,
          subject_id: data.subject_id,
          total_periods: data.total_periods,
          teacher: data.teacher,
          class: data.class,
          subject: data.subject,
          isNew: true,
        },
        ...previous,
      ]);
    }

    setIsAddModalOpen(false);
  };

  const handleLocalDelete = (id: string) => {
    if (!confirm('Xóa phân công này? Hành động chỉ được ghi khi bạn bấm lưu.')) return;

    setIsDirty(true);
    const current = assignments.find((item) => item.id === id);
    if (current?.isNew) {
      setAssignments((previous) => previous.filter((item) => item.id !== id));
      return;
    }

    setDeletedIds((previous) => [...previous, id]);
    setAssignments((previous) => previous.filter((item) => item.id !== id));
  };

  const requestWithCheck = async (url: string, options: RequestInit) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      const payload = await response.text();
      throw new Error(payload || 'Yêu cầu thất bại.');
    }
    return response;
  };

  const handleBatchCommit = async () => {
    if (!confirm('Lưu tất cả thay đổi vào cơ sở dữ liệu?')) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      await Promise.all(
        deletedIds.map((id) =>
          requestWithCheck(`${API_URL}/assignments/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
      );

      const newItems = assignments.filter((item) => item.isNew);
      await Promise.all(
        newItems.map((item) =>
          requestWithCheck(`${API_URL}/assignments`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              teacher_id: item.teacher_id,
              class_id: item.class_id,
              subject_id: item.subject_id,
              total_periods: item.total_periods,
              semester_id: selectedSemesterId,
            }),
          }),
        ),
      );

      const updatedItems = assignments.filter((item) => item.isModified && !item.isNew);
      await Promise.all(
        updatedItems.map((item) =>
          requestWithCheck(`${API_URL}/assignments/${item.id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              teacher_id: item.teacher_id,
              class_id: item.class_id,
              subject_id: item.subject_id,
              total_periods: item.total_periods,
              semester_id: selectedSemesterId,
            }),
          }),
        ),
      );

      await fetchAssignments(selectedSemesterId);
      alert('Đã lưu thay đổi thành công.');
    } catch (error) {
      console.error(error);
      alert('Không thể lưu thay đổi. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (confirm('Hủy toàn bộ thay đổi chưa lưu?')) {
      fetchAssignments(selectedSemesterId);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!selectedYearId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/excel/workbook/template/${selectedYearId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Không tải được file mẫu.');
      }

      const blob = await response.blob();
      const fileName = getFileNameFromDisposition(
        response.headers.get('content-disposition'),
        'mau-phan-cong.xlsx',
      );

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Không thể tải file mẫu Excel.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteAll = async () => {
    if (!selectedSemesterId) return;
    if (isDirty) { alert('Vui lòng lưu hoặc hủy thay đổi trước khi xóa toàn bộ.'); return; }
    if (!confirm(`Xóa TOÀN BỘ ${assignments.length} phân công của học kỳ này? Hành động này không thể hoàn tác.`)) return;
    if (!confirm('Xác nhận lần cuối — bạn chắc chắn muốn xóa hết?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/assignments/all?semester_id=${encodeURIComponent(selectedSemesterId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { await fetchAssignments(selectedSemesterId); alert('Đã xóa toàn bộ phân công.'); }
      else alert('Lỗi khi xóa toàn bộ.');
    } catch (e) {
      alert('Lỗi khi xóa toàn bộ.');
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedYearId) return;

    setIsImporting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/excel/workbook/import/${selectedYearId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      let payload: any;
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      const errorsList = payload.errors ?? [];
      if (!response.ok && errorsList.length === 0) {
        const msg = payload.message
          ?? (typeof payload === 'string' ? payload : `Lỗi server (HTTP ${response.status})`);
        const messages = Array.isArray(msg) ? msg : [msg];
        messages.forEach((m: string) =>
          errorsList.push({ sheet: 'SYSTEM', row: 0, column: '', message: m }),
        );
      }

      setImportResult({
        summary: payload.summary ?? null,
        warnings: payload.warnings ?? [],
        errors: errorsList,
        isError: !response.ok,
      });

      if (response.ok) {
        await fetchYears(selectedYearId, selectedSemesterId);
        await fetchAssignments(selectedSemesterId);
      }
    } catch (error) {
      console.error(error);
      setImportResult({
        summary: null,
        warnings: [],
        errors: [
          {
            message: 'Không thể import file Excel do lỗi kết nối.',
            sheet: 'SYSTEM',
            row: 0,
            column: '',
          },
        ],
        isError: true,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const activeYear = years.find((item) => item.id === selectedYearId);
  const semesterOptions = activeYear?.semesters || [];
  const currentSemester = semesterOptions.find((item) => item.id === selectedSemesterId);

  return (
    <div className="space-y-6 pb-20">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Phân công chuyên môn</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Năm học:</label>
            <select
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500"
              value={selectedYearId}
              onChange={(event) => {
                const nextYear = years.find((item) => item.id === event.target.value);
                setSelectedYearId(event.target.value);
                setSelectedSemesterId(nextYear?.semesters[0]?.id ?? '');
              }}
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Học kỳ:</label>
            <select
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500"
              value={selectedSemesterId}
              onChange={(event) => setSelectedSemesterId(event.target.value)}
            >
              {semesterOptions.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsYearModalOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-200 transition-colors"
            title="Thêm năm học mới"
          >
            <span className="text-base leading-none">+</span> Thêm năm học
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-[var(--text-secondary)]">
          Đang xem:
          <span className="ml-2 font-semibold text-[var(--text-primary)]">
            {activeYear?.name} {currentSemester ? `- ${currentSemester.name}` : ''}
          </span>
          {isDirty && (
            <span className="ml-3 font-semibold text-amber-600">(Có thay đổi chưa lưu)</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsAutoAssignOpen(true)}
            disabled={!selectedYearId}
            className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            Phân công tự động
          </button>
          <div className="h-8 w-px bg-[var(--border-default)] self-center" />
          <button
            onClick={handleDownloadTemplate}
            disabled={!selectedYearId}
            className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Tải mẫu Excel
          </button>
          <button
            onClick={handleImportClick}
            disabled={!selectedYearId || isImporting}
            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
          </button>
          <button
            onClick={() => {
              setEditingAssignment(null);
              setIsAddModalOpen(true);
            }}
            disabled={!selectedSemesterId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Thêm phân công
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={!selectedSemesterId || assignments.length === 0 || isDirty || isSaving}
            title={isDirty ? 'Lưu hoặc hủy thay đổi trước khi xóa toàn bộ' : undefined}
            className="rounded-lg border border-red-600 px-4 py-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Xóa toàn bộ
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-surface-hover)] font-semibold text-[var(--text-primary)]">
            <tr>
              <th className="px-6 py-4">Giáo viên</th>
              <th className="px-6 py-4">Lớp</th>
              <th className="px-6 py-4">Môn học</th>
              <th className="px-6 py-4">Số tiết / tuần</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-secondary)]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  Chưa có phân công nào
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => (
                <tr
                  key={assignment.id}
                  className={
                    assignment.isNew
                      ? 'bg-green-900/20'
                      : assignment.isModified
                        ? 'bg-amber-900/20'
                        : 'hover:bg-[var(--bg-surface-hover)]'
                  }
                >
                  <td className="px-6 py-4 font-medium text-[var(--text-primary)]">
                    {assignment.teacher?.full_name || 'Chưa có giáo viên'}
                  </td>
                  <td className="px-6 py-4">{assignment.class?.name || '---'}</td>
                  <td className="px-6 py-4">
                    {assignment.subject?.name || '---'}
                    {assignment.period_type === 'PRACTICE' && (
                      <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">TH</span>
                    )}
                    {assignment.period_type === 'SPECIAL' && (
                      <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">ĐB</span>
                    )}
                    {assignment.period_type === 'THEORY' && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">LT</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                      {assignment.total_periods}
                    </span>
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    <button
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        setEditingAssignment(assignment);
                        setIsAddModalOpen(true);
                      }}
                    >
                      Sửa
                    </button>
                    <button
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                      onClick={() => handleLocalDelete(assignment.id)}
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

      {isDirty && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-3 shadow-2xl">
          <span className="font-bold text-[var(--text-primary)]">Có thay đổi chưa lưu</span>
          <button
            onClick={handleDiscard}
            disabled={isSaving}
            className="rounded-md px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleBatchCommit}
            disabled={isSaving}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      )}

      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-[var(--bg-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {importResult.isError ? 'Import Excel thất bại' : 'Import Excel hoàn tất'}
              </h3>
              <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-[var(--text-secondary)]">
                ×
              </button>
            </div>

            <div className="space-y-4 p-6">
              {importResult.summary && (
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-hover)] p-4 text-sm text-[var(--text-primary)]">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Môn chuẩn hóa:</span>
                      <span className="font-semibold">{importResult.summary.subjects.upserted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Tổ hợp thay thế:</span>
                      <span className="font-semibold">{importResult.summary.combinations.replaced}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Giáo viên:</span>
                      <span className="font-semibold text-emerald-400">+{importResult.summary.teachers.created}</span>
                      <span className="text-[var(--text-secondary)]">/</span>
                      <span className="font-semibold text-blue-400">↻{importResult.summary.teachers.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Lớp:</span>
                      <span className="font-semibold text-emerald-400">+{importResult.summary.classes.created}</span>
                      <span className="text-[var(--text-secondary)]">/</span>
                      <span className="font-semibold text-blue-400">↻{importResult.summary.classes.updated}</span>
                    </div>
                    <div className="col-span-2 flex justify-between border-t border-[var(--border-default)] pt-2 mt-1">
                      <span className="text-[var(--text-secondary)]">Phân công:</span>
                      <span>
                        <span className="font-semibold text-red-400">xóa {importResult.summary.assignments.deleted}</span>
                        {' → '}
                        <span className="font-semibold text-emerald-400">tạo mới {importResult.summary.assignments.created}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(importResult.warnings?.length ?? 0) > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-amber-700">Cảnh báo</h4>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {importResult.warnings!.slice(0, 20).map((warning, index) => (
                      <div key={`${warning.sheet}-${warning.row}-${index}`}>
                        [{warning.sheet} - dòng {warning.row}] {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(importResult.errors?.length ?? 0) > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-red-700">Lỗi cần xử lý</h4>
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {importResult.errors!.slice(0, 20).map((error, index) => (
                      <div key={`${error.sheet}-${error.row}-${index}`}>
                        [{error.sheet} - dòng {error.row}] {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AssignmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleLocalSave}
        initialData={editingAssignment}
      />

      {isYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface-hover)] px-6 py-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Thêm năm học mới</h3>
              <button onClick={() => setIsYearModalOpen(false)} className="text-gray-400 hover:text-[var(--text-secondary)]">
                ×
              </button>
            </div>
            <form onSubmit={handleCreateYear} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
                  Tên năm học (ví dụ: 2026-2027)
                </label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg border border-[var(--border-default)] p-2"
                  value={newYearName}
                  onChange={(event) => setNewYearName(event.target.value)}
                  placeholder="2026-2027"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Ngày bắt đầu</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    className={`w-full rounded-lg border bg-[var(--bg-surface)] p-2 text-[var(--text-primary)] transition-colors ${
                      startError ? 'border-red-400 focus:ring-red-400' : 'border-[var(--border-default)] focus:ring-blue-500'
                    }`}
                    value={newYearStart}
                    onChange={(event) => setNewYearStart(formatDateInput(event.target.value))}
                  />
                  {startError
                    ? <p className="mt-1 text-xs text-red-500">⚠ {startError}</p>
                    : <p className="mt-1 text-xs text-[var(--text-muted)]">VD: 05/09/2025</p>
                  }
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Ngày kết thúc</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    className={`w-full rounded-lg border bg-[var(--bg-surface)] p-2 text-[var(--text-primary)] transition-colors ${
                      endError ? 'border-red-400 focus:ring-red-400' : 'border-[var(--border-default)] focus:ring-blue-500'
                    }`}
                    value={newYearEnd}
                    onChange={(event) => setNewYearEnd(formatDateInput(event.target.value))}
                  />
                  {endError
                    ? <p className="mt-1 text-xs text-red-500">⚠ {endError}</p>
                    : <p className="mt-1 text-xs text-[var(--text-muted)]">VD: 31/05/2026</p>
                  }
                </div>
              </div>
              <p className="text-xs text-blue-500 italic">
                📘 Theo GDPT 2018: Năm học bắt đầu 05/09 và kết thúc 31/05 năm sau.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsYearModalOpen(false)}
                  className="rounded-lg bg-[var(--bg-surface-hover)] px-4 py-2 font-medium text-[var(--text-secondary)] hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                >
                  Tạo mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Hidden file input for auto-assign */}
      <input
        ref={autoAssignFileRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file || !selectedYearId) return;

          setIsAutoAssigning(true);
          try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/auto-assign/generate/${selectedYearId}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
              alert(data.message || 'Lỗi phân công tự động');
              return;
            }
            setAutoAssignResult(data);
          } catch (err) {
            console.error(err);
            alert('Lỗi kết nối server');
          } finally {
            setIsAutoAssigning(false);
          }
        }}
      />

      {/* Auto-assign modal */}
      {isAutoAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span className="text-2xl">🤖</span> Phân công tự động
              </h2>
              <button
                onClick={() => {
                  setIsAutoAssignOpen(false);
                  setAutoAssignResult(null);
                }}
                className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>

            {!autoAssignResult ? (
              <div className="space-y-6">
                {/* Step 1: Download template */}
                <div className="rounded-xl border border-[var(--border-default)] p-5">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                    Tải mẫu Excel nhập danh sách GV
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    File mẫu gồm: Mã GV, Họ tên, Môn chuyên môn, Khối dạy, Chức vụ, Tiết chuẩn, Giảm trừ, Chủ nhiệm.
                  </p>
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem('token');
                      const res = await fetch(`${API_URL}/auto-assign/template`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'mau-nhap-gv-phan-cong.xlsx';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    📥 Tải mẫu Excel
                  </button>
                </div>

                {/* Step 2: Upload and run */}
                <div className="rounded-xl border border-[var(--border-default)] p-5">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">2</span>
                    Upload file và chạy thuật toán
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    Điền danh sách GV vào file mẫu, sau đó upload để hệ thống tự động phân công GV vào từng lớp.
                  </p>
                  <button
                    onClick={() => autoAssignFileRef.current?.click()}
                    disabled={isAutoAssigning}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
                  >
                    {isAutoAssigning ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Đang phân công...
                      </>
                    ) : (
                      <>📤 Upload Excel & Chạy</>
                    )}
                  </button>
                </div>

                {/* Info */}
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">ℹ️ Quy trình</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Hệ thống đọc danh sách GV từ file Excel</li>
                    <li>Dựa vào CT GDPT 2018 + tổ hợp của từng lớp → tính số tiết cần</li>
                    <li>Thuật toán Greedy tự chia GV vào lớp sao cho cân bằng</li>
                    <li>Xuất kết quả → Admin review + sửa tay → Import lại</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Summary */}
                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <h3 className="font-bold text-green-800 mb-2">✅ Kết quả phân công</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-700">{autoAssignResult.summary.assigned}</div>
                      <div className="text-green-600">Đã phân công</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{autoAssignResult.summary.unassigned}</div>
                      <div className="text-red-500">Chưa phân công</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700">{autoAssignResult.summary.totalDemands}</div>
                      <div className="text-blue-600">Tổng nhu cầu</div>
                    </div>
                  </div>
                </div>

                {/* Teacher stats */}
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-2">👩‍🏫 Thống kê giảng dạy GV</h3>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-[var(--border-default)]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--bg-surface-hover)]">
                        <tr>
                          <th className="px-3 py-2 text-left">Mã GV</th>
                          <th className="px-3 py-2 text-left">Họ tên</th>
                          <th className="px-3 py-2 text-center">Định mức</th>
                          <th className="px-3 py-2 text-center">Đã giao</th>
                          <th className="px-3 py-2 text-center">Thừa/Thiếu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {autoAssignResult.summary.teacherStats.map((t: any) => (
                          <tr key={t.code} className={t.surplus > 0 ? 'bg-red-50' : t.surplus < -3 ? 'bg-amber-50' : ''}>
                            <td className="px-3 py-1.5 font-mono text-xs">{t.code}</td>
                            <td className="px-3 py-1.5">{t.name}</td>
                            <td className="px-3 py-1.5 text-center">{t.effectiveLoad}</td>
                            <td className="px-3 py-1.5 text-center font-semibold">{t.assignedPeriods}</td>
                            <td className={`px-3 py-1.5 text-center font-bold ${t.surplus > 0 ? 'text-red-600' : t.surplus < 0 ? 'text-green-600' : ''}`}>
                              {t.surplus > 0 ? `+${t.surplus}` : t.surplus}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Warnings */}
                {autoAssignResult.warnings.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-amber-700 mb-2">⚠️ Cảnh báo ({autoAssignResult.warnings.length})</h3>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                      {autoAssignResult.warnings.map((w: string, i: number) => (
                        <div key={i}>• {w}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setAutoAssignResult(null);
                    }}
                    className="rounded-lg bg-[var(--bg-surface-hover)] px-4 py-2 font-medium text-[var(--text-secondary)] hover:bg-gray-200"
                  >
                    ← Chạy lại
                  </button>
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem('token');
                      const res = await fetch(`${API_URL}/auto-assign/export/${selectedYearId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'phan-cong-tu-dong.xlsx';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 flex items-center gap-2"
                  >
                    📥 Xuất Excel phân công
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
