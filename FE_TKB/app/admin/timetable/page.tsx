'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import TimetableGrid from '../../components/admin/TimetableGrid';
import QualityBreakdown from '../../components/admin/QualityBreakdown';
import SolverMonitor, { SolveProgress } from '../../components/admin/SolverMonitor';
import VariantComparison from '../../components/admin/VariantComparison';
import CascadeSwapDialog from '../../components/admin/CascadeSwapDialog';
import ChangeHistory from '../../components/admin/ChangeHistory';
import { API_URL } from '@/lib/api';
import Select from '@/app/components/ui/Select';

interface Semester {
  id: string;
  name: string;
}

interface SchoolYear {
  id: string;
  name: string;
  semesters: Semester[];
}

const PREFLIGHT_PAGE_SIZE = 10;

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
  const [preflightPage, setPreflightPage] = useState(1);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
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
        showToast('Thời khóa biểu còn lỗi cứng - chưa dùng được. Xem nhật ký bên dưới.', 'error');
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
        setResult({
          fitness_score: fitness,
          bestSchedule: schedule,
          fitnessDetails: data.fitnessDetails,
          penaltyPerSlot: data.penaltyPerSlot,
          quality: data.quality,
          softBreakdown: data.softBreakdown ?? [],
          hardViolations: data.hardViolations,
          offenders: data.offenders ?? [],
          timetableId: data.timetableId,
        });
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
      setPreflightPage(1);
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

  const preflightIssueCount = preflight?.issues?.length ?? 0;
  const preflightTotalPages = Math.max(1, Math.ceil(preflightIssueCount / PREFLIGHT_PAGE_SIZE));
  const currentPreflightPage = Math.min(preflightPage, preflightTotalPages);
  const preflightPageStart = (currentPreflightPage - 1) * PREFLIGHT_PAGE_SIZE;
  const visiblePreflightIssues = preflight?.issues?.slice(
    preflightPageStart,
    preflightPageStart + PREFLIGHT_PAGE_SIZE,
  ) ?? [];

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
            toast.type === 'success' ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'
          }`}
        >
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-800">Xếp thời khóa biểu</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">Năm học</label>
            <Select
              value={selectedYearId}
              onChange={(value) => {
                const year = years.find((item) => item.id === value);
                setSelectedYearId(value);
                setSelectedSemesterId(year?.semesters?.[0]?.id ?? '');
              }}
              placeholder="Chọn năm học"
              options={years.map((year) => ({ value: String(year.id), label: year.name }))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-800">Học kỳ</label>
            <Select
              value={selectedSemesterId}
              onChange={setSelectedSemesterId}
              placeholder="Chọn học kỳ"
              disabled={!selectedYear}
              options={(selectedYear?.semesters ?? []).map((semester) => ({ value: String(semester.id), label: semester.name }))}
            />
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

            {preflight.issues.length === 0 && <p className="text-sm text-gray-500">Không phát hiện vấn đề nào.</p>}

            <ul className="space-y-2">
              {visiblePreflightIssues.map((issue: any, index: number) => (
                <li
                  key={`${issue.code}-${preflightPageStart + index}`}
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
                      <a href={issue.link.href} className="ml-auto text-sm font-medium text-blue-600 hover:underline">
                        {issue.link.label} →
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{issue.detail}</p>
                  {issue.suggestion && <p className="mt-1 text-sm italic text-gray-500">→ {issue.suggestion}</p>}
                </li>
              ))}
            </ul>

            {preflightTotalPages > 1 && (
              <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3" aria-label="Phân trang cảnh báo dữ liệu đầu vào">
                <p className="text-sm text-gray-500">
                  Hiển thị {preflightPageStart + 1}-{Math.min(preflightPageStart + PREFLIGHT_PAGE_SIZE, preflightIssueCount)} trong {preflightIssueCount} cảnh báo
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreflightPage((page) => Math.max(1, page - 1))}
                    disabled={currentPreflightPage === 1}
                    className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  >
                    Trước
                  </button>
                  <span className="min-w-20 text-center text-sm font-semibold text-gray-700">
                    Trang {currentPreflightPage}/{preflightTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreflightPage((page) => Math.min(preflightTotalPages, page + 1))}
                    disabled={currentPreflightPage === preflightTotalPages}
                    className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-[transform,background-color,border-color] hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  >
                    Sau
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}

        <SolverMonitor progress={progress} history={scoreHistory} classes={classes} isRunning={isGenerating} />

      </div>

      {result?.bestSchedule && (
        <>
          <section className="space-y-3" aria-labelledby="quality-report-heading">
            <h2 id="quality-report-heading" className="text-lg font-semibold text-[var(--text-primary)]">
              Báo cáo lỗi và chất lượng
            </h2>
            <QualityBreakdown
              quality={result.quality}
              score={result.fitness_score ?? null}
              slotCount={result.bestSchedule?.length ?? 0}
              hardViolations={result.hardViolations}
              items={result.softBreakdown ?? []}
            />
          </section>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <h2 className="text-xl font-bold text-gray-800">Thời khóa biểu hoàn chỉnh</h2>

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

                <Select
                  className="w-full sm:w-64"
                  value={selectedEntityId}
                  onChange={setSelectedEntityId}
                  aria-label={viewMode === 'CLASS' ? 'Chọn lớp' : 'Chọn giáo viên'}
                  placeholder={viewMode === 'CLASS' ? 'Chọn lớp' : 'Chọn giáo viên'}
                  searchPlaceholder={viewMode === 'CLASS' ? 'Tìm lớp...' : 'Tìm giáo viên...'}
                  options={
                    viewMode === 'CLASS'
                      ? classes.map((item) => ({ value: String(item.id), label: item.name }))
                      : teachers.map((item) => ({ value: String(item.id), label: item.full_name }))
                  }
                />
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
        </>
      )}

      <section className="space-y-4" aria-label="Nhật ký và phương án thời khóa biểu">
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

        <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm">
          <div className="mb-2 border-b border-[var(--border-default)] pb-2 font-semibold text-[var(--text-secondary)]">
            Nhật ký hệ thống
          </div>
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--bg-surface-hover)]"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>{log}</span>
              </div>
            ))
          ) : (
            <span className="text-[var(--text-muted)]">Sẵn sàng chờ lệnh...</span>
          )}
        </div>
      </section>
    </div>
  );
}
