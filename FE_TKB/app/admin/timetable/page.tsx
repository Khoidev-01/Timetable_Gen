'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import TimetableGrid from '../../components/admin/TimetableGrid';
import SolverMonitor, { SolveProgress } from '../../components/admin/SolverMonitor';
import VariantComparison from '../../components/admin/VariantComparison';
import CascadeSwapDialog from '../../components/admin/CascadeSwapDialog';
import ChangeHistory from '../../components/admin/ChangeHistory';
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
  const [preflight, setPreflight] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
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
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SolveProgress | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const socketRef = useRef<Socket | null>(null);

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

  // Live progress replaces the old three-second poll, which showed nothing at all
  // until the whole run had finished
  useEffect(() => {
    if (!selectedSemesterId) return;

    const socket = io(`${API_URL}/solver`, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('watch', selectedSemesterId));

    socket.on('progress', (frame: SolveProgress) => {
      setProgress(frame);
      setScoreHistory((previous) => [...previous.slice(-119), frame.score]);
    });

    socket.on('done', async (payload: any) => {
      setIsGenerating(false);
      setProgress(null);
      await checkExistingResult(selectedSemesterId);

      if (payload?.stats?.rejected > 0) {
        setLogs((previous) => [
          ...previous,
          `Cảnh báo: ${payload.stats.rejected} tiết không lưu được (sinh ${payload.stats.generated}, lưu ${payload.stats.saved}).`,
        ]);
      }

      if (payload?.isValid === false) {
        showToast('Thời khóa biểu còn lỗi cứng — chưa dùng được. Xem nhật ký bên dưới.', 'error');
      } else if (payload?.success) {
        showToast('Đã tạo thời khóa biểu thành công.', 'success');
      }
    });

    return () => {
      socket.emit('unwatch', selectedSemesterId);
      socket.disconnect();
      socketRef.current = null;
    };
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
        setResult({ fitness_score: fitness, bestSchedule: schedule, fitnessDetails: data.fitnessDetails, offenders: data.offenders ?? [], timetableId: data.timetableId });
        setLogs((previous) => [...previous, `Đã tải ${schedule.length} tiết học cho học kỳ đang chọn.`]);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const runPreflight = async () => {
    if (!selectedSemesterId) return null;
    setIsChecking(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/preflight/${selectedSemesterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const report = await response.json();
      setPreflight(report);
      return report;
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const handleStart = async () => {
    if (!selectedSemesterId) return;

    // Check the data first - a blocking problem always produces a broken timetable,
    // and finding out after a full solve wastes everyone's time
    const report = await runPreflight();
    if (report && !report.canRun) {
      const proceed = window.confirm(
        `Dữ liệu còn ${report.summary.block} lỗi nghiêm trọng.\n` +
          'Thời khóa biểu sinh ra gần như chắc chắn sẽ thiếu tiết.\n\nVẫn tiếp tục?',
      );
      if (!proceed) return;
    }

    setIsGenerating(true);
    setProgress(null);
    setScoreHistory([]);
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
      setLogs((previous) => [...previous, `Đã tạo job ${payload.jobId}, đang theo dõi trực tiếp...`]);
      setScoreHistory([]);
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
      showToast('Lỗi kết nối khi khởi động thuật toán.', 'error');
    }
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
      <CascadeSwapDialog
        slotId={swapSlotId}
        onClose={() => setSwapSlotId(null)}
        onApplied={() => checkExistingResult(selectedSemesterId)}
      />

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
              onClick={runPreflight}
              disabled={!selectedSemesterId || isChecking || isGenerating}
              className="rounded-lg border border-purple-300 px-4 py-2.5 font-semibold text-purple-700 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Kiểm tra dữ liệu đầu vào trước khi xếp"
            >
              {isChecking ? 'Đang kiểm tra...' : 'Kiểm tra'}
            </button>
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

        {preflight && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="font-bold text-gray-800">Kiểm tra dữ liệu đầu vào</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  preflight.score >= 85
                    ? 'bg-emerald-100 text-emerald-700'
                    : preflight.score >= 60
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {preflight.score}/100
              </span>
              <span className="text-sm text-gray-600">
                {preflight.capacity.periodsRequired} tiết / {preflight.capacity.cellsAvailable} ô khả dụng
                {' · '}
                {preflight.summary.block} chặn · {preflight.summary.risk} rủi ro · {preflight.summary.note} lưu ý
              </span>
              {preflight.canRun ? (
                <span className="text-sm font-semibold text-emerald-600">Có thể xếp lịch</span>
              ) : (
                <span className="text-sm font-semibold text-red-600">Cần sửa trước khi xếp</span>
              )}
            </div>

            {preflight.issues.length === 0 && (
              <p className="text-sm text-gray-500">Không phát hiện vấn đề nào.</p>
            )}

            <ul className="space-y-2">
              {preflight.issues.map((issue: any, index: number) => (
                <li
                  key={`${issue.code}-${index}`}
                  className={`rounded-lg border-l-4 bg-gray-50 p-3 ${
                    issue.level === 'BLOCK'
                      ? 'border-red-500'
                      : issue.level === 'RISK'
                        ? 'border-amber-500'
                        : 'border-gray-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                        issue.level === 'BLOCK'
                          ? 'bg-red-500 text-white'
                          : issue.level === 'RISK'
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-400 text-white'
                      }`}
                    >
                      {issue.level === 'BLOCK' ? 'CHẶN' : issue.level === 'RISK' ? 'RỦI RO' : 'LƯU Ý'}
                    </span>
                    <span className="font-semibold text-gray-800">{issue.title}</span>
                    {issue.link && (
                      <a
                        href={issue.link.href}
                        className="ml-auto text-sm font-medium text-blue-600 hover:underline"
                      >
                        {issue.link.label} →
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{issue.detail}</p>
                  {issue.suggestion && (
                    <p className="mt-1 text-sm italic text-gray-500">→ {issue.suggestion}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <SolverMonitor
          progress={progress}
          history={scoreHistory}
          classes={classes}
          isRunning={isGenerating}
        />

        <ChangeHistory
          timetableId={result?.timetableId ?? null}
          onReverted={() => checkExistingResult(selectedSemesterId)}
        />

        {selectedSemesterId && !isGenerating && (
          <VariantComparison
            key={`${selectedSemesterId}-${result?.fitness_score ?? 'none'}`}
            semesterId={selectedSemesterId}
            onPublished={() => checkExistingResult(selectedSemesterId)}
          />
        )}

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
            onRequestSwap={setSwapSlotId}
            offenderIds={new Set<string>((result?.offenders ?? []).flatMap((group: any) => group.slotIds))}
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
