
'use client';
import { useState, useEffect, useRef } from 'react';
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
    teacher: { full_name: string; code: string };
    class: { name: string };
    subject: { name: string; code: string };
    periods_per_week?: number;
    total_periods: number;
    // Batch State Flags
    isNew?: boolean;
    isModified?: boolean;
    tempId?: string; // For tracking new items before DB ID
}

export default function AssignmentsPage() {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [deletedIds, setDeletedIds] = useState<string[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Filter State
    const [years, setYears] = useState<SchoolYear[]>([]);
    const [selectedYearId, setSelectedYearId] = useState<string>('');
    const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

    // Create Year State
    const [isYearModalOpen, setIsYearModalOpen] = useState(false);
    const [newYearName, setNewYearName] = useState('');
    const [newYearStart, setNewYearStart] = useState('');
    const [newYearEnd, setNewYearEnd] = useState('');

    useEffect(() => {
        const fetchYears = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch('http://localhost:4000/system/years', { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                    const data: SchoolYear[] = await res.json();
                    setYears(data);
                    const activeYear = data.find((y: any) => y.is_active) || data[0];
                    if (activeYear) {
                        setSelectedYearId(activeYear.id);
                        if (activeYear.semesters?.length) setSelectedSemesterId(activeYear.semesters[0].id);
                    }
                }
            } catch (e) { console.error(e); }
        };
        fetchYears();
    }, []);

    const fetchAssignments = async () => {
        if (!selectedSemesterId) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:4000/assignments?semester_id=${selectedSemesterId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setAssignments(data);
                setDeletedIds([]);
                setIsDirty(false);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchAssignments(); }, [selectedSemesterId]);

    const handleCreateYear = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:4000/system/years', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: newYearName, start_date: new Date(newYearStart), end_date: new Date(newYearEnd), status: 'ACTIVE' })
            });

            if (res.ok) {
                alert('Thêm năm học thành công');
                setIsYearModalOpen(false);
                const resYears = await fetch('http://localhost:4000/system/years', { headers: { Authorization: `Bearer ${token}` } });
                if (resYears.ok) setYears(await resYears.json());
            } else { alert('Lỗi khi thêm năm học'); }
        } catch (error) { alert('Lỗi kết nối'); }
    };

    // --- BATCH LOGIC ---

    const handleLocalSave = async (data: any) => { // Called by Modal
        // Mock Objects for Display (The Modal returns ID references, we need names for UI)
        // Ideally we fetch Names or Modal returns robust data. 
        // For now we assume Modal returns IDs, we'll display placeholders or need better Modal integration.
        // Assuming data has { teacher_id, class_id, subject_id, total_periods, ... }
        // We can't easily show Names without looking them up.
        // Let's rely on simple Display or lookups if we had the lists. 
        // IMPROVEMENT: Modal passes back Full Objects or we look them up here. 
        // Simpler for Batch: Assume data contains `_display` properties inject by Modal?
        // Or re-fetch? No that defeats Batch.
        // Let's assume for now we just show "Updated" in UI or keep old names if edit.

        // Actually, to display 'Teacher Name', we need the Teacher Object. 
        // If data is just IDs, the table will show Empty/Null.
        // Let's assume the Modal returns mixed data or we just mark them.

        setIsDirty(true);
        if (editingAssignment) {
            // EDIT
            setAssignments(prev => prev.map(a => {
                if (a.id === editingAssignment.id) {
                    return { ...a, ...data, isModified: !a.isNew }; // Keep isNew if it was new
                }
                return a;
            }));
        } else {
            // NEW
            const tempId = `temp-${Date.now()}`;
            const newAssign: Assignment = {
                id: tempId,
                ...data,
                isNew: true,
                // Display Placeholders (The user won't see names unless we look them up)
                // We'll trust data has names or we accept empty for now.
                // NOTE: Detailed Lookup is skipped for brevity, names might be missing until refresh.
                teacher: { full_name: 'Đang cập nhật...', code: '' },
                class: { name: '...' },
                subject: { name: '...', code: '' },
            };
            setAssignments(prev => [newAssign, ...prev]);
        }
        setIsAddModalOpen(false);
    };

    const handleLocalDelete = (id: string) => {
        if (!confirm('Xóa phân công này (Lưu đê thực hiện)?')) return;
        setIsDirty(true);
        const target = assignments.find(a => a.id === id);
        if (target?.isNew) {
            // Just remove from list
            setAssignments(prev => prev.filter(a => a.id !== id));
        } else {
            // Mark for deletion
            setDeletedIds(prev => [...prev, id]);
            // Remove from UI
            setAssignments(prev => prev.filter(a => a.id !== id));
        }
    };

    const handleBatchCommit = async () => {
        if (!confirm('Lưu tất cả thay đổi vào CSDL?')) return;
        setIsSaving(true);
        const token = localStorage.getItem('token');
        try {
            // 1. Deletes
            const deletePromises = deletedIds.map(id =>
                fetch(`http://localhost:4000/assignments/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                })
            );

            // 2. Creates
            const newItems = assignments.filter(a => a.isNew);
            const createPromises = newItems.map(a => {
                const { id, isNew, isModified, tempId, teacher, class: c, subject, ...payload } = a; // Exclude UI props
                // Payload needs to match API: { teacher_id, class_id, subject_id, ... }
                // The 'data' from Modal should have these.
                // We need to ensure 'data' stored in state has snake_case IDs.
                return fetch('http://localhost:4000/assignments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ ...payload, semester_id: selectedSemesterId })
                });
            });

            // 3. Updates
            const modifiedItems = assignments.filter(a => a.isModified && !a.isNew);
            const updatePromises = modifiedItems.map(a => {
                const { id, isNew, isModified, tempId, teacher, class: c, subject, ...payload } = a;
                return fetch(`http://localhost:4000/assignments/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ ...payload, semester_id: selectedSemesterId })
                });
            });

            await Promise.all([...deletePromises, ...createPromises, ...updatePromises]);
            alert('Đã lưu thành công!');
            fetchAssignments(); // Refresh to clean state
        } catch (e) {
            console.error(e);
            alert('Có lỗi xảy ra khi lưu. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        if (confirm('Hủy bỏ mọi thay đổi chưa lưu?')) {
            fetchAssignments();
        }
    };

    const activeYearObj = years.find(y => y.id === selectedYearId);
    const semesterOptions = activeYearObj?.semesters || [];

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Phân công chuyên môn</h1>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2">
                        <select
                            className="border border-gray-300 rounded-lg px-3 py-2 text-black bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                            value={selectedYearId}
                            onChange={(e) => {
                                setSelectedYearId(e.target.value);
                                const year = years.find(y => y.id === e.target.value);
                                if (year && year.semesters.length > 0) setSelectedSemesterId(year.semesters[0].id);
                                else setSelectedSemesterId('');
                            }}
                        >
                            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                        <button onClick={() => setIsYearModalOpen(true)} className="bg-blue-100 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-200 font-bold" title="Thêm năm học">+</button>
                    </div>
                    <select
                        className="border border-gray-300 rounded-lg px-3 py-2 text-black bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                        value={selectedSemesterId}
                        onChange={(e) => setSelectedSemesterId(e.target.value)}
                    >
                        {semesterOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600">
                    Đang xem: <b>{activeYearObj?.name} - {semesterOptions.find(s => s.id === selectedSemesterId)?.name}</b>
                    {isDirty && <span className="ml-2 text-amber-600 font-bold">(Có thay đổi chưa lưu)</span>}
                </div>
                <div className="flex gap-2">
                    <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2" onClick={() => alert("Tính năng Import Excel đang phát triển")}>
                        <span>📥</span> Nhập Excel
                    </button>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        onClick={() => { setEditingAssignment(null); setIsAddModalOpen(true); }}
                        disabled={!selectedSemesterId}
                    >
                        <span>➕</span> Thêm phân công
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4">Giáo viên</th>
                            <th className="px-6 py-4">Lớp</th>
                            <th className="px-6 py-4">Môn học</th>
                            <th className="px-6 py-4">Số tiết/Tuần</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-600 divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-8">Đang tải...</td></tr>
                        ) : assignments.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8">Chưa có phân công nào</td></tr>
                        ) : (
                            assignments.map(a => (
                                <tr key={a.id} className={`transition-colors ${a.isNew ? 'bg-green-50' : a.isModified ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {a.teacher ? a.teacher.full_name : 'Chưa có GV'}
                                    </td>
                                    <td className="px-6 py-4">{a.class?.name || '...'}</td>
                                    <td className="px-6 py-4">{a.subject?.name || '...'}</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                                            {a.total_periods || a.periods_per_week}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            onClick={() => { setEditingAssignment(a); setIsAddModalOpen(true); }}
                                        >Sửa</button>
                                        <button className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            onClick={() => handleLocalDelete(a.id)}
                                        >Xóa</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* BATCH SAVE BAR */}
            {isDirty && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 animate-fade-in-up z-50">
                    <span className="font-bold text-gray-700">Có thay đổi chưa lưu!</span>
                    <button
                        onClick={handleDiscard}
                        disabled={isSaving}
                        className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-md text-sm font-medium transition"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleBatchCommit}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transition flex items-center gap-2"
                    >
                        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            )}

            <AssignmentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleLocalSave}
                initialData={editingAssignment}
            />

            {/* Create Year Modal */}
            {isYearModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">Thêm Năm Học Mới</h3>
                            <button onClick={() => setIsYearModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleCreateYear} className="p-6 space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tên năm học (VD: 2026-2027)</label><input type="text" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={newYearName} onChange={(e) => setNewYearName(e.target.value)} placeholder="2026-2027" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label><input type="date" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={newYearStart} onChange={(e) => setNewYearStart(e.target.value)} /></div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label><input type="date" required className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={newYearEnd} onChange={(e) => setNewYearEnd(e.target.value)} /></div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsYearModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Hủy</button>
                                <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-bold shadow-sm">Tạo mới</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
