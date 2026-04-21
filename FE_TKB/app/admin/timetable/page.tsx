'use client';

import { useEffect, useState } from 'react';
import TimetableGrid from '../../components/admin/TimetableGrid';
import MonthlyTimetableGrid from '../../components/admin/MonthlyTimetableGrid';
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

interface ScheduleSlot {
  id: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  subject?: { name: string; code: string; color?: string };
  teacherId?: string;
  teacherName?: string;
  roomId?: string;
  roomName?: string;
  day: number;
  period: number;
  session: number;
  is_locked?: boolean;
}

interface FitnessBreakdownItem {
  code: string;
  label: string;
  count: number;
  unitPenalty: number;
  penalty: number;
}

interface FitnessSummary {
  score: number;
  hardViolations: number;
  softPenalty: number;
  details: string[];
  hardDetails: FitnessBreakdownItem[];
  softDetails: FitnessBreakdownItem[];
}

interface TimetableResult {
  bestSchedule: ScheduleSlot[];
  fitness_score: number;
  fitnessDetails: string[];
  fitness: FitnessSummary;
  is_official?: boolean;
  generated_at?: string;
}

type LogKind = 'client' | 'server' | 'success' | 'error' | 'info' | 'warn';

interface LogEntry {
  id: string;
  time: string;
  kind: LogKind;
  message: string;
}

type LogStateEntry = LogEntry | string;

type FitnessItemType = 'hard' | 'soft';

interface FitnessRule {
  code: string;
  label: string;
  type: FitnessItemType;
  unitPenalty: number;
  patterns: string[];
}

const FITNESS_RULES: FitnessRule[] = [
  {
    code: 'teacher_conflict',
    label: 'Giáo viên trùng giờ',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['giao vien trung gio'],
  },
  {
    code: 'class_conflict',
    label: 'Lớp học trùng giờ',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['lop hoc trung gio'],
  },
  {
    code: 'room_conflict',
    label: 'Phòng học trùng giờ',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['phong hoc trung gio'],
  },
  {
    code: 'teacher_busy',
    label: 'Giáo viên dạy khi bận',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['giao vien day khi ban'],
  },
  {
    code: 'special_subject_time',
    label: 'GDTC/GDQP học giờ nắng',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['gdtc/gdqp hoc gio nang'],
  },
  {
    code: 'heavy_subject_session',
    label: 'Môn nặng trùng buổi / quá 2 tiết',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['xep >=2 mon nang', 'mon nang trung buoi', 'qua 2 tiet cung mon nang'],
  },
  {
    code: 'thursday_restriction',
    label: 'Vi phạm lịch nghỉ thứ 5',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['vi pham lich nghi thu 5'],
  },
  {
    code: 'same_subject_overload',
    label: 'Môn học >2 tiết liên tiếp',
    type: 'hard',
    unitPenalty: 100,
    patterns: ['mon hoc xep >2 tiet lien tiep', 'mon hoc >2 tiet lien tiep'],
  },
  {
    code: 'spread_subjects',
    label: 'Môn học dồn cục',
    type: 'soft',
    unitPenalty: 10,
    patterns: ['mon hoc don cuc'],
  },
  {
    code: 'morning_priority',
    label: 'Môn ưu tiên ở tiết cuối',
    type: 'soft',
    unitPenalty: 15,
    patterns: ['mon uu tien o tiet cuoi'],
  },
  {
    code: 'split_blocks',
    label: 'Môn 2 tiết bị xé lẻ',
    type: 'soft',
    unitPenalty: 10,
    patterns: ['mon 2 tiet bi xe le'],
  },
  {
    code: 'teacher_holes',
    label: 'Tiết trống giáo viên',
    type: 'soft',
    unitPenalty: 5,
    patterns: ['tiet trong giao vien'],
  },
  {
    code: 'teacher_max_load',
    label: 'Giáo viên dạy quá số tiết/buổi',
    type: 'soft',
    unitPenalty: 10,
    patterns: ['giao vien day qua so tiet/buoi'],
  },
];

function createLogEntry(message: string, kind: LogKind = 'info'): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString(),
    kind,
    message,
  };
}

function normalizeLogEntry(entry: LogStateEntry, index: number): LogEntry {
  if (typeof entry !== 'string') {
    return entry;
  }

  const serverPrefix = '[SERVER] ';
  const timePrefix = entry.match(/^\[(\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?)\]\s*/i);
  const hasServerPrefix = entry.startsWith(serverPrefix);
  const time = timePrefix?.[1] ?? '--:--:--';
  const message = entry
    .replace(serverPrefix, '')
    .replace(/^\[(\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?)\]\s*/i, '');

  return {
    id: `legacy-${index}`,
    time,
    kind: hasServerPrefix ? 'server' : 'info',
    message,
  };
}

function normalizeBreakdownItems(raw: unknown): FitnessBreakdownItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const entry = item as Partial<FitnessBreakdownItem>;
    return {
      code: entry.code ?? 'unknown',
      label: entry.label ?? entry.code ?? 'Unknown',
      count: Number(entry.count ?? 0),
      unitPenalty: Number(entry.unitPenalty ?? 0),
      penalty: Number(entry.penalty ?? 0),
    };
  });
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseLegacyFitnessDetails(details: string[], fallbackScore = 0): FitnessSummary {
  const hardDetails: FitnessBreakdownItem[] = [];
  const softDetails: FitnessBreakdownItem[] = [];
  const buckets = {
    hard: new Map<string, FitnessBreakdownItem>(),
    soft: new Map<string, FitnessBreakdownItem>(),
  };

  for (const detail of details) {
    const normalizedDetail = normalizeText(detail);
    const matchedRule = FITNESS_RULES.find((rule) =>
      rule.patterns.some((pattern) => normalizedDetail.includes(pattern)),
    );

    const penaltyMatch = detail.match(/-(\d+)/);
    const countMatch = detail.match(/\((\d+)\s*(?:loi|lỗi)\)/i);
    const penalty = Number(penaltyMatch?.[1] ?? 0);
    const explicitCount = Number(countMatch?.[1] ?? 0);
    const type: FitnessItemType = matchedRule?.type ?? (explicitCount > 0 ? 'hard' : 'soft');
    const unitPenalty =
      matchedRule?.unitPenalty ??
      (explicitCount > 0 ? Math.round(penalty / explicitCount) || 0 : 0);
    const count =
      explicitCount > 0
        ? explicitCount
        : unitPenalty > 0 && penalty > 0
          ? Math.round(penalty / unitPenalty)
          : 0;
    const code =
      matchedRule?.code ??
      `${type}-${normalizeText(detail.split(':')[0] ?? detail).replace(/[^a-z0-9]+/g, '-')}`;
    const label = matchedRule?.label ?? (detail.split(':')[0]?.trim() || detail.trim());
    const bucket = buckets[type];

    bucket.set(code, {
      code,
      label,
      count,
      unitPenalty,
      penalty,
    });
  }

  hardDetails.push(...buckets.hard.values());
  softDetails.push(...buckets.soft.values());

  const hardViolations = hardDetails.reduce((sum, item) => sum + item.count, 0);
  const softPenalty = softDetails.reduce((sum, item) => sum + item.penalty, 0);
  const inferredScore =
    fallbackScore !== 0 || details.length === 0
      ? fallbackScore
      : 1000 - hardViolations * 100 - softPenalty;

  return {
    score: inferredScore,
    hardViolations,
    softPenalty,
    details,
    hardDetails,
    softDetails,
  };
}

function normalizeFitness(raw: unknown, fallbackScore = 0, fallbackDetails: string[] = []): FitnessSummary {
  const value = raw as Partial<FitnessSummary> | null;
  const details = Array.isArray(value?.details) ? value.details : fallbackDetails;
  const hardDetails = normalizeBreakdownItems(value?.hardDetails);
  const softDetails = normalizeBreakdownItems(value?.softDetails);
  const legacyFallback = parseLegacyFitnessDetails(details, fallbackScore);
  const resolvedScore =
    value?.score !== undefined && value?.score !== null
      ? Number(value.score)
      : fallbackScore !== 0
        ? fallbackScore
        : legacyFallback.score;

  return {
    score: resolvedScore,
    hardViolations:
      hardDetails.length > 0 || softDetails.length > 0 || Number(value?.hardViolations ?? 0) > 0
        ? Number(value?.hardViolations ?? 0)
        : legacyFallback.hardViolations,
    softPenalty:
      hardDetails.length > 0 || softDetails.length > 0 || Number(value?.softPenalty ?? 0) > 0
        ? Number(value?.softPenalty ?? 0)
        : legacyFallback.softPenalty,
    details,
    hardDetails: hardDetails.length > 0 ? hardDetails : legacyFallback.hardDetails,
    softDetails: softDetails.length > 0 ? softDetails : legacyFallback.softDetails,
  };
}

function formatPenalty(value: number) {
  return value > 0 ? `-${value}` : '0';
}

function getFitnessStatus(fitness: FitnessSummary | null) {
  if (!fitness) {
    return {
      label: 'No data',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (fitness.hardViolations > 0) {
    return {
      label: 'Invalid',
      className: 'border-red-200 bg-red-100 text-red-700',
    };
  }

  if (fitness.score >= 980) {
    return {
      label: 'Excellent',
      className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    };
  }

  if (fitness.score >= 950) {
    return {
      label: 'Good',
      className: 'border-blue-200 bg-blue-100 text-blue-700',
    };
  }

  if (fitness.score >= 900) {
    return {
      label: 'Usable',
      className: 'border-amber-200 bg-amber-100 text-amber-700',
    };
  }

  return {
    label: 'Weak',
    className: 'border-orange-200 bg-orange-100 text-orange-700',
  };
}

function formatGeneratedAt(value?: string) {
  if (!value) return '---';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
  const [result, setResult] = useState<TimetableResult | null>(null);
  const [logs, setLogs] = useState<LogStateEntry[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [displayMode, setDisplayMode] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [newYearEnd, setNewYearEnd] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [generations, setGenerations] = useState(1000);
  const [restarts, setRestarts] = useState(5);

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

  const appendLog = (message: string, kind: LogKind = 'info') => {
    setLogs((previous) => [...previous, createLogEntry(message, kind)]);
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
      appendLog('Failed to load school years.', 'error');
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
      appendLog('Failed to load generated timetable result.', 'error');
    }
  };

  const openCreateYearModal = () => {
    setEditingYearId(null);
    setNewYearName('');
    setNewYearStart('');
    setNewYearEnd('');
    setIsYearModalOpen(true);
  };

  const openEditYearModal = () => {
    const year = years.find((y) => y.id === selectedYearId) as any;
    if (!year) return;
    setEditingYearId(year.id);
    setNewYearName(year.name);
    setNewYearStart(year.start_date ? new Date(year.start_date).toISOString().split('T')[0] : '');
    setNewYearEnd(year.end_date ? new Date(year.end_date).toISOString().split('T')[0] : '');
    setIsYearModalOpen(true);
  };

  const handleSaveYear = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const isEditing = !!editingYearId;
      const url = isEditing ? `${API_URL}/system/years/${editingYearId}` : `${API_URL}/system/years`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newYearName,
          start_date: new Date(newYearStart),
          end_date: new Date(newYearEnd),
          ...(!isEditing && { status: 'ACTIVE' }),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        showToast(err?.message || `Không thể ${isEditing ? 'cập nhật' : 'tạo'} năm học.`, 'error');
        return;
      }

      setIsYearModalOpen(false);
      setEditingYearId(null);
      fetchYears();
      showToast(isEditing ? 'Đã cập nhật năm học.' : 'Đã thêm năm học mới.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Lỗi kết nối.', 'error');
    }
  };

  const handleDeleteYear = async () => {
    if (!selectedYearId) return;
    const year = years.find((y) => y.id === selectedYearId);
    if (!confirm(`Bạn có chắc muốn xóa năm học "${year?.name}"? Thao tác này không thể hoàn tác.`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/system/years/${selectedYearId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        showToast(err?.message || 'Không thể xóa năm học.', 'error');
        return;
      }

      setSelectedYearId('');
      setSelectedSemesterId('');
      fetchYears();
      showToast('Đã xóa năm học.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Lỗi kết nối khi xóa năm học.', 'error');
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
      let schedule: ScheduleSlot[] = [];
      let fitness = 0;
      let fitnessDetails: string[] = [];
      let generatedAt: string | undefined;
      let isOfficial = false;
      let fitnessSummary = normalizeFitness(null);

      if (Array.isArray(data)) {
        schedule = data;
      } else if (data?.bestSchedule) {
        schedule = data.bestSchedule;
        fitness = data.fitness_score ?? 0;
        fitnessDetails = Array.isArray(data.fitnessDetails) ? data.fitnessDetails : [];
        generatedAt = data.generated_at;
        isOfficial = Boolean(data.is_official);
        fitnessSummary = normalizeFitness(data.fitness, fitness, fitnessDetails);
      }

      if (schedule.length > 0) {
        setResult({
          bestSchedule: schedule,
          fitness_score: fitnessSummary.score || fitness,
          fitnessDetails: fitnessSummary.details,
          fitness: fitnessSummary,
          is_official: isOfficial,
          generated_at: generatedAt,
        });
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
    setLogs((previous) => [
      ...previous,
      `[${new Date().toLocaleTimeString()}] Config: ${generations} generations, ${restarts} restarts.`,
    ]);
    setLogs((previous) => [...previous, `[${new Date().toLocaleTimeString()}] Bắt đầu xếp thời khóa biểu...`]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          semesterId: selectedSemesterId,
          generations,
          restarts,
        }),
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
    let lastState = '';
    let lastNumericProgress = -1;
    const timer = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/algorithm/status/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const payload = await response.json();
        if (payload?.state && payload.state !== lastState) {
          lastState = payload.state;
          appendLog(`Job ${jobId} -> ${payload.state}`, 'server');
        }

        if (typeof payload?.progress === 'number' && payload.progress !== lastNumericProgress) {
          lastNumericProgress = payload.progress;
          appendLog(`Job ${jobId} progress ${payload.progress}%`, 'server');
        }
        if (payload?.state === 'completed') {
          clearInterval(timer);
          if (payload.result?.debugLogs) {
            setLogs((previous) => [
              ...previous,
              ...payload.result.debugLogs.map((line: string) => createLogEntry(line, 'server')),
            ]);
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

  const handleClear = async () => {
    if (!selectedSemesterId) return;
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ thời khóa biểu hiện tại? Thao tác này không thể hoàn tác.')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/algorithm/clear/${selectedSemesterId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        showToast('Không thể xóa thời khóa biểu.', 'error');
        return;
      }

      setResult(null);
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Đã xóa thời khóa biểu thành công.`]);
      showToast('Đã xóa thời khóa biểu.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Lỗi kết nối khi xóa thời khóa biểu.', 'error');
    }
  };

  const selectedYear = years.find((item) => item.id === selectedYearId);
  const fitness = result?.fitness ?? null;
  const fitnessStatus = getFitnessStatus(fitness);
  const renderedLogs = logs.map(normalizeLogEntry).slice().reverse();

  const logKindClassName: Record<LogKind, string> = {
    client: 'border-blue-500/30 bg-blue-500/10 text-blue-100',
    server: 'border-violet-500/30 bg-violet-500/10 text-violet-100',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    error: 'border-red-500/30 bg-red-500/10 text-red-100',
    info: 'border-slate-500/30 bg-slate-500/10 text-slate-100',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  };

  return (
    <div className="relative space-y-6 pb-20">
      {toast && (
        <div
          className={`fixed right-6 top-20 z-50 rounded-lg border-l-4 bg-[var(--bg-surface)] px-6 py-4 shadow-lg ${
            toast.type === 'success'
              ? 'border-green-500 text-green-700'
              : 'border-red-500 text-red-700'
          }`}
        >
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}

      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Xếp thời khóa biểu</h1>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-bold text-[var(--text-primary)]">Năm học</label>
              <div className="flex gap-1">
                <button
                  onClick={openEditYearModal}
                  disabled={!selectedYearId}
                  className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-600 hover:bg-amber-200 disabled:opacity-40"
                  title="Sửa năm học"
                >
                  ✏️ Sửa
                </button>
                <button
                  onClick={handleDeleteYear}
                  disabled={!selectedYearId}
                  className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-200 disabled:opacity-40"
                  title="Xóa năm học"
                >
                  🗑️
                </button>
                <button
                  onClick={openCreateYearModal}
                  className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-200"
                >
                  + Thêm
                </button>
              </div>
            </div>
            <select
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 font-medium text-[var(--text-primary)]"
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
            <label className="mb-2 block text-sm font-bold text-[var(--text-primary)]">Học kỳ</label>
            <select
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 font-medium text-[var(--text-primary)]"
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

          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-primary)]">Optimization</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Generations</label>
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={100}
                  value={generations}
                  onChange={(event) => setGenerations(Number(event.target.value))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 font-medium text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Restarts</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={restarts}
                  onChange={(event) => setRestarts(Number(event.target.value))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 font-medium text-[var(--text-primary)]"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Higher values take longer but usually search better schedules.
            </p>
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
              onClick={handleClear}
              disabled={!selectedSemesterId || !result?.bestSchedule}
              className="rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Xóa thời khóa biểu hiện tại"
            >
              🗑️ Xóa
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

        <div className="max-h-[340px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-inner">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
            Nhật ký hệ thống
          </div>
          {renderedLogs.length > 0 ? (
            renderedLogs.map((log) => (
              <div key={log.id} className={`mb-2 rounded-md border px-3 py-2 font-mono text-xs ${logKindClassName[log.kind]}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="font-semibold uppercase tracking-wide">{log.kind}</span>
                  <span className="text-[11px] opacity-70">{log.time}</span>
                </div>
                <div className="break-words leading-relaxed">{log.message}</div>
              </div>
            ))
          ) : (
            <span className="opacity-50">Sẵn sàng chờ lệnh...</span>
          )}
        </div>
      </div>

      {result?.bestSchedule && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-sm">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Thời khóa biểu hoàn chỉnh</h2>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                Fitness: <span className={result.fitness_score < 0 ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>{result.fitness_score ?? '---'}</span>
              </div>
              {result?.fitnessDetails && result.fitnessDetails.length > 0 && (
                <div className="mt-2 text-xs text-red-500">
                  <div className="font-semibold mb-1">Chi tiết lỗi (Cần khắc phục để TKB hợp lệ):</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {result.fitnessDetails.map((detail: string, idx: number) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}

              {fitness && (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${fitnessStatus.className}`}>
                      {fitnessStatus.label}
                    </span>
                    {result.generated_at && (
                      <span className="text-xs text-[var(--text-muted)]">
                        Generated {formatGeneratedAt(result.generated_at)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Score</div>
                      <div className="mt-1 text-2xl font-bold text-emerald-900">{fitness.score}</div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Hard Errors</div>
                      <div className="mt-1 text-2xl font-bold text-red-900">{fitness.hardViolations}</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Soft Penalty</div>
                      <div className="mt-1 text-2xl font-bold text-amber-900">{formatPenalty(fitness.softPenalty)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Slots</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900">{result.bestSchedule.length}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-lg border border-red-200 bg-red-50/60 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-red-800">Hard Constraints</h3>
                        <span className="text-xs font-semibold text-red-700">{fitness.hardViolations} violations</span>
                      </div>
                      {fitness.hardDetails.length > 0 ? (
                        <div className="space-y-2">
                          {fitness.hardDetails.map((item) => (
                            <div key={item.code} className="rounded-md border border-red-200 bg-white/80 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                                <span className="text-sm font-bold text-red-700">{formatPenalty(item.penalty)}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                Count: {item.count} | Unit: {item.unitPenalty}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                          No hard constraint violations.
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-amber-800">Soft Penalties</h3>
                        <span className="text-xs font-semibold text-amber-700">{formatPenalty(fitness.softPenalty)}</span>
                      </div>
                      {fitness.softDetails.length > 0 ? (
                        <div className="space-y-2">
                          {fitness.softDetails.map((item) => (
                            <div key={item.code} className="rounded-md border border-amber-200 bg-white/80 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                                <span className="text-sm font-bold text-amber-700">{formatPenalty(item.penalty)}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                Count: {item.count} | Unit: {item.unitPenalty}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                          No soft penalties.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-hover)] p-1">
                <button
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    displayMode === 'WEEK' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setDisplayMode('WEEK')}
                >
                  Lịch Tuần
                </button>
                <button
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    displayMode === 'MONTH' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setDisplayMode('MONTH')}
                >
                  Lịch Tháng
                </button>
              </div>

              <div className="flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-hover)] p-1">
                <button
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'CLASS' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setViewMode('CLASS')}
                >
                  Xem theo lớp
                </button>
                <button
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'TEACHER' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setViewMode('TEACHER')}
                >
                  Xem theo giáo viên
                </button>
              </div>

              <select
                className="min-w-[220px] rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-base font-semibold text-[var(--text-primary)]"
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

          {displayMode === 'WEEK' ? (
            <TimetableGrid
              schedule={result.bestSchedule}
              viewMode={viewMode}
              selectedEntityId={selectedEntityId}
              onSlotMove={handleSlotMove}
              onToggleLock={handleToggleLock}
            />
          ) : (
            <MonthlyTimetableGrid
              schedule={result.bestSchedule}
              viewMode={viewMode}
              selectedEntityId={selectedEntityId}
            />
          )}
        </div>
      )}

      {isYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-[var(--bg-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface-hover)] px-6 py-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{editingYearId ? 'Sửa năm học' : 'Thêm năm học mới'}</h3>
              <button onClick={() => setIsYearModalOpen(false)} className="text-gray-400 hover:text-[var(--text-secondary)]">
                ×
              </button>
            </div>
            <form onSubmit={handleSaveYear} className="space-y-4 p-6">
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
                    type="date"
                    required
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--text-primary)]"
                    value={newYearStart}
                    onChange={(event) => setNewYearStart(event.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Ngày kết thúc</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-[var(--text-primary)]"
                    value={newYearEnd}
                    onChange={(event) => setNewYearEnd(event.target.value)}
                  />
                </div>
              </div>
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
                  {editingYearId ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
