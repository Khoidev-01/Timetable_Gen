'use client';

import { useEffect, useRef, useState } from 'react';
import AssignmentModal from '../../components/admin/AssignmentModal';

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

const API_URL = 'http://localhost:4000';

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleCreateYear = async (event: React.FormEvent) => {
    event.preventDefault();
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
          start_date: new Date(newYearStart),
          end_date: new Date(newYearEnd),
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

      const payload = await response.json();
      setImportResult({
        ...payload,
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
        <h1 className="text-2xl font-bold text-gray-800">Phân công chuyên môn</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-black focus:ring-2 focus:ring-blue-500"
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
            <button
              onClick={() => setIsYearModalOpen(true)}
              className="rounded-lg bg-blue-100 px-3 py-2 font-bold text-blue-600 hover:bg-blue-200"
              title="Thêm năm học"
            >
              +
            </button>
          </div>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-black focus:ring-2 focus:ring-blue-500"
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
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-gray-600">
          Đang xem:
          <span className="ml-2 font-semibold text-gray-900">
            {activeYear?.name} {currentSemester ? `- ${currentSemester.name}` : ''}
          </span>
          {isDirty && (
            <span className="ml-3 font-semibold text-amber-600">(Có thay đổi chưa lưu)</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-gray-200 bg-gray-50 font-semibold text-gray-900">
            <tr>
              <th className="px-6 py-4">Giáo viên</th>
              <th className="px-6 py-4">Lớp</th>
              <th className="px-6 py-4">Môn học</th>
              <th className="px-6 py-4">Số tiết / tuần</th>
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
                      ? 'bg-green-50'
                      : assignment.isModified
                        ? 'bg-amber-50'
                        : 'hover:bg-gray-50'
                  }
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {assignment.teacher?.full_name || 'Chưa có giáo viên'}
                  </td>
                  <td className="px-6 py-4">{assignment.class?.name || '---'}</td>
                  <td className="px-6 py-4">{assignment.subject?.name || '---'}</td>
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
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-gray-200 bg-white px-6 py-3 shadow-2xl">
          <span className="font-bold text-gray-700">Có thay đổi chưa lưu</span>
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
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-800">
                {importResult.isError ? 'Import Excel thất bại' : 'Import Excel hoàn tất'}
              </h3>
              <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600">
                ×
              </button>
            </div>

            <div className="space-y-4 p-6">
              {importResult.summary && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-4 text-sm">
                    <div>Môn chuẩn hóa: {importResult.summary.subjects.upserted}</div>
                    <div>
                      Giáo viên: +{importResult.summary.teachers.created} / cập nhật{' '}
                      {importResult.summary.teachers.updated}
                    </div>
                    <div>
                      Lớp: +{importResult.summary.classes.created} / cập nhật{' '}
                      {importResult.summary.classes.updated}
                    </div>
                    <div>Tổ hợp thay thế: {importResult.summary.combinations.replaced}</div>
                    <div>
                      Phân công: xóa {importResult.summary.assignments.deleted}, tạo mới{' '}
                      {importResult.summary.assignments.created}
                    </div>
                  </div>
                </div>
              )}

              {importResult.warnings.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-amber-700">Cảnh báo</h4>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {importResult.warnings.slice(0, 20).map((warning, index) => (
                      <div key={`${warning.sheet}-${warning.row}-${index}`}>
                        [{warning.sheet} - dòng {warning.row}] {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-red-700">Lỗi cần xử lý</h4>
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {importResult.errors.slice(0, 20).map((error, index) => (
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
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-800">Thêm năm học mới</h3>
              <button onClick={() => setIsYearModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                ×
              </button>
            </div>
            <form onSubmit={handleCreateYear} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Tên năm học (ví dụ: 2026-2027)
                </label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg border border-gray-300 p-2"
                  value={newYearName}
                  onChange={(event) => setNewYearName(event.target.value)}
                  placeholder="2026-2027"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ngày bắt đầu</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-gray-300 p-2"
                    value={newYearStart}
                    onChange={(event) => setNewYearStart(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ngày kết thúc</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-gray-300 p-2"
                    value={newYearEnd}
                    onChange={(event) => setNewYearEnd(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsYearModalOpen(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-600 hover:bg-gray-200"
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
    </div>
  );
}
