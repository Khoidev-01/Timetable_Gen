'use client';
import { useState, useEffect } from 'react';
import TimetableGrid from '../../components/admin/TimetableGrid';

interface Semester {
    id: string;
    name: string; // Updated from ten_hoc_ky
}

interface SchoolYear {
    id: string;
    name: string; // Updated from ten_nam_hoc
    semesters: Semester[]; // Updated from ds_hoc_ky
}

export default function TimetablePage() {
    const [years, setYears] = useState<SchoolYear[]>([]);
    const [selectedYearId, setSelectedYearId] = useState<string>('');
    const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);


    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [classes, setClasses] = useState<any[]>([]);

    const [teachers, setTeachers] = useState<any[]>([]);

    // Create Year State
    const [isYearModalOpen, setIsYearModalOpen] = useState(false);
    const [newYearName, setNewYearName] = useState('');
    const [newYearStart, setNewYearStart] = useState('');
    const [newYearEnd, setNewYearEnd] = useState('');

    useEffect(() => {
        fetchYears();
    }, []);

    useEffect(() => {
        if (selectedSemesterId) {
            setResult(null); // Clear previous result
            checkExistingResult(selectedSemesterId);
            fetchMetadata(selectedSemesterId);
        }
    }, [selectedSemesterId]);

    useEffect(() => {
        if (viewMode === 'CLASS' && classes.length > 0) setSelectedEntityId(classes[0].id);
        if (viewMode === 'TEACHER' && teachers.length > 0) setSelectedEntityId(teachers[0].id);
    }, [viewMode, classes, teachers]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    const fetchYears = async () => {
        try {
            const token = localStorage.getItem('token');
            // Updated Endpoint: /system/years
            const res = await fetch('http://localhost:4000/system/years', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setYears(data);
                if (data.length > 0) {
                    setSelectedYearId(data[0].id);
                    // Updated property access: semesters
                    const sems = data[0].semesters || [];
                    if (sems.length > 0) {
                        setSelectedSemesterId(sems[0].id);
                    }
                }
            }
        } catch (error) { console.error(error); }
    };

    const fetchMetadata = async (semesterId: string) => {
        try {
            const token = localStorage.getItem('token');
            // Updated Endpoint: /organization/classes (Filtered by year in real impl, but here listing all?)
            // Or /algorithm/classes if that existed. Let's use /organization/classes for now.
            const resClasses = await fetch(`http://localhost:4000/organization/classes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resClasses.ok) setClasses(await resClasses.json());

            // Updated Endpoint: /resources/teachers
            const resTeachers = await fetch('http://localhost:4000/resources/teachers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resTeachers.ok) setTeachers(await resTeachers.json());

        } catch (error) { console.error(error); }
    };

    const handleCreateYear = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:4000/system/years', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newYearName,
                    start_date: new Date(newYearStart),
                    end_date: new Date(newYearEnd),
                    status: 'ACTIVE'
                })
            });

            if (res.ok) {
                showToast('Thêm năm học thành công', 'success');
                setIsYearModalOpen(false);
                setNewYearName('');
                setNewYearStart('');
                setNewYearEnd('');
                fetchYears(); // Refresh list
            } else {
                showToast('Lỗi khi thêm năm học', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi kết nối', 'error');
        }
    };

    const checkExistingResult = async (semesterId: string) => {
        try {
            // console.log('Fetching result for semester:', semesterId);
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:4000/algorithm/result/${semesterId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();

                // DATA NORMALIZATION
                let schedule = [];
                let fitness = 0;

                if (Array.isArray(data)) {
                    schedule = data;
                } else if (data && data.bestSchedule) {
                    schedule = data.bestSchedule;
                    fitness = data.fitness_score;
                }

                if (schedule.length > 0) {
                    setResult({ fitness_score: fitness, bestSchedule: schedule });
                    setLogs(prev => [...prev, `Đã tải ${schedule.length} tiết học. Fitness: ${fitness}`]);
                    setIsGenerating(false);
                } else {
                    setLogs(prev => [...prev, `Không tìm thấy dữ liệu TKB cho học kỳ này.`]);
                }
            } else {
                console.error('Fetch failed:', res.status);
            }
        } catch (e) { console.error(e); }
    };

    const handleStart = async () => {
        if (!selectedSemesterId) return;
        setIsGenerating(true);
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Đang gửi yêu cầu xếp thời khóa biểu (Mode: Queue)...`]);

        try {
            const token = localStorage.getItem('token');
            const url = `http://localhost:4000/algorithm/start`;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ semesterId: selectedSemesterId })
            });

            if (res.ok) {
                const data = await res.json();
                setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Job started: ${data.jobId}`]);
                pollResult(data.jobId);
            } else {
                showToast('Khởi động thất bại', 'error');
                setIsGenerating(false);
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi kết nối', 'error');
            setIsGenerating(false);
        }
    };

    const pollResult = (jobId: string) => {
        const interval = setInterval(async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`http://localhost:4000/algorithm/status/${jobId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();

                    if (data && data.state === 'completed') {
                        clearInterval(interval);

                        // Show Backend Debug Logs
                        if (data.result && data.result.debugLogs) {
                            data.result.debugLogs.forEach((l: string) => {
                                setLogs(prev => [...prev, `[SERVER] ${l}`]);
                            });
                        }

                        // Handle result
                        if (data.result && data.result.timetableId) {
                            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Đã tạo TKB (ID: ${data.result.timetableId}). Đang tải dữ liệu...`]);
                            setTimeout(() => checkExistingResult(selectedSemesterId), 500);
                        } else if (data.result) {
                            // Direct result (unlikely with current backend but handling it)
                            if (Array.isArray(data.result)) {
                                setResult({ bestScore: 0, bestSchedule: data.result });
                            } else {
                                setResult(data.result);
                            }
                            setIsGenerating(false);
                            showToast('Xếp thời khóa biểu thành công!', 'success');
                        } else {
                            setLogs(prev => [...prev, 'Hoàn thành nhưng không có dữ liệu trả về.']);
                            setIsGenerating(false);
                        }

                    } else if (data && data.state === 'failed') {
                        setLogs(prev => [...prev, 'Thất bại: Có lỗi xảy ra trong quá trình xử lý.']);
                        setIsGenerating(false);
                        clearInterval(interval);
                        showToast('Xử lý thất bại', 'error');
                    }
                }
            } catch (e) {
                console.error(e);
                clearInterval(interval);
                setIsGenerating(false);
            }
        }, 3000);
    };

    // Manual Adjustment State (Drag & Drop)
    const [isMoving, setIsMoving] = useState(false);

    const handleSlotMove = async (fromSlot: any, to: { day: number, period: number, session: number }) => {
        if (!result || !selectedSemesterId || isMoving) return;
        if (!fromSlot || !fromSlot.id) return;

        // Note: Manual Move only supported in Class View for now (or Teacher view if logic allows)
        // Since we move by Slot ID, Backend handles it regardless of view mode.
        // But refreshing context matters.

        if (fromSlot.day === to.day && fromSlot.period === to.period) return;

        setIsMoving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:4000/algorithm/move-slot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    slotId: fromSlot.id,
                    newDay: to.day,
                    newPeriod: to.period
                })
            });

            if (res.ok) {
                await checkExistingResult(selectedSemesterId);
                showToast('Cập nhật thành công', 'success');
            } else {
                showToast('Lỗi khi cập nhật thời khóa biểu', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi kết nối', 'error');
        } finally {
            setIsMoving(false);
        }
    };

    const handleToggleLock = async (slotId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:4000/algorithm/toggle-lock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ slotId })
            });

            if (res.ok) {
                await checkExistingResult(selectedSemesterId);
                showToast('Đã cập nhật khóa/mở khóa', 'success');
            } else {
                showToast('Lỗi khi cập nhật', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi kết nối', 'error');
        }
    };

    const handleExport = async () => {
        if (!selectedSemesterId) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:4000/algorithm/export/${selectedSemesterId}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `TKB_HocKy_${selectedSemesterId}.xlsx`; // Or meaningful name
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                showToast('Xuất file thành công', 'success');
            } else {
                showToast('Lỗi khi xuất file Excel', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Lỗi kết nối', 'error');
        }
    };

    return (
        <div className="space-y-6 pb-20 relative">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-20 right-6 px-6 py-4 rounded-lg shadow-lg z-50 animate-fade-in-down border-l-4 ${toast.type === 'success' ? 'bg-white border-green-500 text-green-700' : 'bg-white border-red-500 text-red-700'}`}>
                    <div className="flex items-center gap-3">
                        {toast.type === 'success' ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        )}
                        <span className="font-semibold">{toast.message}</span>
                    </div>
                </div>
            )}

            <h1 className="text-2xl font-bold text-gray-800">Xếp Thời Khóa Biểu</h1>

            {/* Control Panel */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-gray-800">Năm học</label>
                            <button
                                onClick={() => setIsYearModalOpen(true)}
                                className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 font-bold"
                                title="Thêm năm học mới"
                            >
                                + Thêm
                            </button>
                        </div>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg text-black bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                            value={selectedYearId}
                            onChange={(e) => {
                                setSelectedYearId(e.target.value);
                                const year = years.find(y => y.id === e.target.value);
                                if (year?.semesters?.length) setSelectedSemesterId(year.semesters[0].id);
                                else setSelectedSemesterId('');
                            }}
                        >
                            {years.map(y => (
                                <option key={y.id} value={y.id}>{y.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">Học kỳ</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg text-black bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                            value={selectedSemesterId}
                            onChange={(e) => setSelectedSemesterId(e.target.value)}
                        >
                            {years.find(y => y.id === selectedYearId)?.semesters?.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-end gap-2 h-full">
                            {!isGenerating ? (
                                <>
                                    <button
                                        onClick={handleStart}
                                        disabled={!selectedSemesterId}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        🚀 Bắt đầu
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        disabled={!selectedSemesterId || !result?.bestSchedule}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                        Xuất Excel
                                    </button>
                                </>
                            ) : (
                                <button disabled className="w-full bg-gray-400 text-white font-bold py-2.5 px-6 rounded-lg cursor-wait flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Đang xử lý...
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Logs */}
                <div className="mt-4 bg-gray-900 p-4 rounded-lg border border-gray-700 max-h-48 overflow-y-auto text-xs font-mono text-green-400 shadow-inner">
                    <div className="mb-2 text-gray-400 font-bold border-b border-gray-700 pb-1">Nhật ký hệ thống</div>
                    {logs.length > 0 ? logs.map((log, i) => (
                        <div key={i} className="mb-1 last:mb-0 hover:bg-gray-800 p-0.5 rounded">{log}</div>
                    )) : <span className="opacity-50">Sẵn sàng chờ lệnh...</span>}
                </div>
            </div>

            {/* Timetable View */}
            {result && result.bestSchedule && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span>📅 Thời khóa biểu</span>
                                {result.bestScore > 0 && <span className="text-sm font-normal text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">Fitness: {result.bestScore.toFixed(4)}</span>}
                            </h2>
                            {isMoving && <span className="text-xs text-blue-600 animate-pulse font-medium">Đang cập nhật...</span>}
                        </div>

                        {/* Fitness Details Panel */}
                        {result.fitnessDetails && result.fitnessDetails.length > 0 && (
                            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white shadow-xl border border-red-100 rounded-lg p-4 z-40 max-w-lg w-full max-h-60 overflow-y-auto group hover:max-h-96 transition-all">
                                <h3 className="text-sm font-bold text-red-600 mb-2 border-b pb-1">⚠️ Cảnh báo xung đột & Mức độ hợp lý</h3>
                                <ul className="space-y-1">
                                    {result.fitnessDetails.map((detail: string, idx: number) => (
                                        <li key={idx} className="text-xs text-gray-700 flex items-start gap-2">
                                            <span className="text-red-500">•</span>
                                            {detail}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                            {/* View Mode Toggle */}
                            <div className="flex bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
                                <button
                                    className={`px-4 py-2 text-sm font-medium transition ${viewMode === 'CLASS' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                    onClick={() => setViewMode('CLASS')}
                                >
                                    Xem theo Lớp
                                </button>
                                <div className="w-px bg-gray-200"></div>
                                <button
                                    className={`px-4 py-2 text-sm font-medium transition ${viewMode === 'TEACHER' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                    onClick={() => setViewMode('TEACHER')}
                                >
                                    Xem theo GV
                                </button>
                            </div>

                            {/* Entity Selector */}
                            <select
                                className="p-2 text-base font-semibold text-black border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-600 min-w-[220px] bg-white shadow-sm cursor-pointer hover:border-blue-400"
                                value={selectedEntityId}
                                onChange={(e) => setSelectedEntityId(e.target.value)}
                            >
                                {viewMode === 'CLASS' ? (
                                    classes.map(c => <option key={c.id} value={c.id} className="text-black font-medium">{c.name}</option>)
                                ) : (
                                    teachers.map(t => <option key={t.id} value={t.id} className="text-black font-medium">{t.full_name}</option>)
                                )}
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

                    {/* Stats Section */}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                            <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2">Điểm Đánh Giá (Fitness)</h3>
                            <div className={`text-4xl font-black ${result.fitness_score >= 1000 ? 'text-green-600' : 'text-amber-500'}`}>
                                {result.fitness_score ?? '---'}
                                <span className="text-lg text-gray-400 font-medium ml-1">/ 1000</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Càng cao càng tốt</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                            <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2">Trạng Thái</h3>
                            {result.fitness_score >= 1000 ? (
                                <div className="flex items-center gap-2 text-green-600 font-bold text-xl">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    Hợp lý
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-red-600 font-bold text-xl">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    Còn vi phạm ràng buộc
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-2">Dựa trên các ràng buộc cứng</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                            <h3 className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2">Ước Tính Vi Phạm</h3>
                            <div className="text-3xl font-bold text-gray-700">
                                {result.fitness_score ? Math.ceil((1000 - result.fitness_score) / 100) : 0}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Lỗi vi phạm cứng cần khắc phục</p>
                        </div>
                    </div>
                </div>
            )}
            {/* Create Year Modal */}
            {isYearModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">Thêm Năm Học Mới</h3>
                            <button onClick={() => setIsYearModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleCreateYear} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tên năm học (VD: 2026-2027)</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    value={newYearName}
                                    onChange={(e) => setNewYearName(e.target.value)}
                                    placeholder="2026-2027"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={newYearStart}
                                        onChange={(e) => setNewYearStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        value={newYearEnd}
                                        onChange={(e) => setNewYearEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsYearModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-bold shadow-sm"
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
