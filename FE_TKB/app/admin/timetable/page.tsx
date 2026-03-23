'use client';

import { useEffect, useState } from 'react';
import TimetableGrid from '../../components/admin/TimetableGrid';
import { API_URL } from '@/lib/api';

interface Semester {
  id: string;
  name: string;
}

interface SchoolYear {
  id: string;
  name: string;
  semesters: Semester[];
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

export default function TimetablePage() {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [newYearEnd, setNewYearEnd] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (selectedSemesterId) {
      setResult(null);
      checkExistingResult(selectedSemesterId);
      fetchMetadata();
    }
  }, [selectedSemesterId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (viewMode === 'CLASS' && classes.length > 0) {
      setSelectedEntityId(classes[0].id);
    }
    if (viewMode === 'TEACHER' && teachers.length > 0) {
      setSelectedEntityId(teachers[0].id);
    }
  }, [classes, teachers, viewMode]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const fetchYears = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/system/years`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;

      const data = await response.json();
      setYears(data);
      if (data.length > 0) {
        setSelectedYearId((current) => current || data[0].id);
        setSelectedSemesterId((current) => current || data[0].semesters?.[0]?.id || '');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMetadata = async () => {
    try {
      const token = localStorage.getItem('token');
      const [classResponse, teacherResponse] = await Promise.all([
        fetch(`${API_URL}/organization/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/resources/teachers`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (classResponse.ok) setClasses(await classResponse.json());
      if (teacherResponse.ok) setTeachers(await teacherResponse.json());
    } catch (error) {
      console.error(error);
    }
  };

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
        showToast('Không thể tạo năm học.', 'error');
        return;
      }

      setIsYearModalOpen(false);
      setNewYearName('');
      setNewYearStart('');
      setNewYearEnd('');
      fetchYears();
      showToast('Đã thêm năm học mới.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Lỗi kết nối khi tạo năm học.', 'error');
    }
  };

  const checkExistingResult = async (semesterId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/result/${semesterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      let schedule = [];
      let fitness = 0;

      if (Array.isArray(data)) {
        schedule = data;
      } else if (data?.bestSchedule) {
        schedule = data.bestSchedule;
        fitness = data.fitness_score ?? 0;
      }

      if (schedule.length > 0) {
        setResult({ fitness_score: fitness, bestSchedule: schedule, fitnessDetails: data.fitnessDetails });
        setLogs((previous) => [...previous, `Đã tải ${schedule.length} tiết học cho học kỳ đang chọn.`]);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleStart = async () => {
    if (!selectedSemesterId) return;

    setIsGenerating(true);
    setLogs((previous) => [...previous, `[${new Date().toLocaleTimeString()}] Bắt đầu xếp thời khóa biểu...`]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ semesterId: selectedSemesterId }),
      });

      if (!response.ok) {
        setIsGenerating(false);
        showToast('Không thể khởi động tiến trình xếp thời khóa biểu.', 'error');
        return;
      }

      const payload = await response.json();
      setLogs((previous) => [...previous, `Đã tạo job ${payload.jobId}.`]);
      pollResult(payload.jobId);
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
      showToast('Lỗi kết nối khi khởi động thuật toán.', 'error');
    }
  };

  const pollResult = (jobId: string) => {
    const timer = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/algorithm/status/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const payload = await response.json();
        if (payload?.state === 'completed') {
          clearInterval(timer);
          if (payload.result?.debugLogs) {
            payload.result.debugLogs.forEach((line: string) => {
              setLogs((previous) => [...previous, `[SERVER] ${line}`]);
            });
          }
          setLogs((previous) => [...previous, 'Thuật toán hoàn tất, đang nạp lại dữ liệu...']);
          await checkExistingResult(selectedSemesterId);
          setIsGenerating(false);
          showToast('Đã tạo thời khóa biểu thành công.', 'success');
        }

        if (payload?.state === 'failed') {
          clearInterval(timer);
          setIsGenerating(false);
          showToast('Thuật toán thất bại.', 'error');
        }
      } catch (error) {
        console.error(error);
        clearInterval(timer);
        setIsGenerating(false);
      }
    }, 3000);
  };

  const handleSlotMove = async (fromSlot: any, to: { day: number; period: number; session: number }) => {
    if (!result || !selectedSemesterId || isMoving || !fromSlot?.id) return;
    if (fromSlot.day === to.day && fromSlot.period === to.period) return;

    setIsMoving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/move-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slotId: fromSlot.id,
          newDay: to.day,
          newPeriod: to.period,
        }),
      });

      if (!response.ok) {
        showToast('Không thể cập nhật vị trí tiết học.', 'error');
        return;
      }

      await checkExistingResult(selectedSemesterId);
      showToast('Đã cập nhật thời khóa biểu.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Lỗi kết nối khi cập nhật.', 'error');
    } finally {
      setIsMoving(false);
    }
  };

  const handleToggleLock = async (slotId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/toggle-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slotId }),
      });

      if (!response.ok) {
        showToast('Không thể khóa / mở khóa tiết học.', 'error');
        return;
      }

      await checkExistingResult(selectedSemesterId);
      showToast('Đã cập nhật trạng thái khóa.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Lỗi kết nối khi cập nhật trạng thái khóa.', 'error');
    }
  };

  const handleExport = async () => {
    if (!selectedSemesterId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/export/${selectedSemesterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        showToast('Không thể xuất file Excel thời khóa biểu.', 'error');
        return;
      }

      const blob = await response.blob();
      const fileName = getFileNameFromDisposition(
        response.headers.get('content-disposition'),
        `thoi-khoa-bieu-${selectedSemesterId}.xlsx`,
      );

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      showToast('Đã xuất file Excel thời khóa biểu.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Lỗi kết nối khi xuất Excel.', 'error');
    }
  };

  const selectedYear = years.find((item) => item.id === selectedYearId);

  return (
    <div className="relative space-y-6 pb-20">
      {toast && (
        <div
          className={`fixed right-6 top-20 z-50 rounded-lg border-l-4 bg-white px-6 py-4 shadow-lg ${
            toast.type === 'success'
              ? 'border-green-500 text-green-700'
              : 'border-red-500 text-red-700'
          }`}
        >
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-800">Xếp thời khóa biểu</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-bold text-gray-800">Năm học</label>
              <button
                onClick={() => setIsYearModalOpen(true)}
                className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-200"
              >
                + Thêm
              </button>
            </div>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white p-2 font-medium text-black"
              value={selectedYearId}
              onChange={(event) => {
                const year = years.find((item) => item.id === event.target.value);
                setSelectedYearId(event.target.value);
                setSelectedSemesterId(year?.semesters?.[0]?.id ?? '');
              }}
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">Học kỳ</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white p-2 font-medium text-black"
              value={selectedSemesterId}
              onChange={(event) => setSelectedSemesterId(event.target.value)}
            >
              {selectedYear?.semesters?.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleStart}
              disabled={!selectedSemesterId || isGenerating}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? 'Đang xử lý...' : 'Bắt đầu'}
            </button>
            <button
              onClick={handleExport}
              disabled={!selectedSemesterId || !result?.bestSchedule}
              className="rounded-lg bg-green-600 px-4 py-2.5 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xuất Excel
            </button>
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs text-green-400 shadow-inner">
          <div className="mb-2 border-b border-gray-700 pb-1 font-bold text-gray-400">
            Nhật ký hệ thống
          </div>
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="mb-1 rounded p-0.5 hover:bg-gray-800">
                {log}
              </div>
            ))
          ) : (
            <span className="opacity-50">Sẵn sàng chờ lệnh...</span>
          )}
        </div>
      </div>

      {result?.bestSchedule && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Thời khóa biểu hoàn chỉnh</h2>
              <div className="mt-1 text-sm text-gray-500">
                Fitness: {result.fitness_score ?? '---'}
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-2">
              <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    viewMode === 'CLASS' ? 'bg-blue-600 text-white' : 'text-gray-600'
                  }`}
                  onClick={() => setViewMode('CLASS')}
                >
                  Xem theo lớp
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    viewMode === 'TEACHER' ? 'bg-blue-600 text-white' : 'text-gray-600'
                  }`}
                  onClick={() => setViewMode('TEACHER')}
                >
                  Xem theo giáo viên
                </button>
              </div>

              <select
                className="min-w-[220px] rounded-md border border-gray-400 bg-white p-2 text-base font-semibold text-black"
                value={selectedEntityId}
                onChange={(event) => setSelectedEntityId(event.target.value)}
              >
                {viewMode === 'CLASS'
                  ? classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  : teachers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          <TimetableGrid
            schedule={result.bestSchedule}
            viewMode={viewMode}
            selectedEntityId={selectedEntityId}
            onSlotMove={handleSlotMove}
            onToggleLock={handleToggleLock}
          />
        </div>
      )}

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
