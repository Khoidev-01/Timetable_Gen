'use client';
import { useState, useEffect } from 'react';
import SubjectModal from '../../components/admin/SubjectModal';
import { API_URL } from '@/lib/api';

// ... (Define Subject Interface with Batch Flags)
interface Subject {
    id: number;
    code: string;
    name: string;
    color: string;
    is_special: boolean;
    is_practice: boolean;
    // Batch Flags
    isNew?: boolean;
    isModified?: boolean;
    tempId?: boolean; // If id is number, we use negative for temp? Or just rely on isNew
}

export default function SubjectsPage() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [deletedIds, setDeletedIds] = useState<number[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSubjects = async () => {
        try {
            const t = localStorage.getItem('token');
            if (!t) return;
            setToken(t);
            setIsLoading(true);
            const res = await fetch(`${API_URL}/resources/subjects`, {
                headers: { Authorization: `Bearer ${t}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSubjects(data);
                setDeletedIds([]);
                setIsDirty(false);
            }
        } catch (error) { console.error(error); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchSubjects(); }, []);

    // --- BATCH LOGIC ---

    const handleLocalSave = async (data: any) => {
        setIsDirty(true);
        if (editingSubject) {
            // EDIT
            setSubjects(prev => prev.map(s =>
                s.id === editingSubject.id
                    ? { ...s, ...data, isModified: !s.isNew }
                    : s
            ));
        } else {
            // NEW
            // Use a negative random ID for temp check (assuming DB IDs are positive)
            const newId = -Date.now();
            setSubjects(prev => [{ ...data, id: newId, isNew: true }, ...prev]);
        }
        setIsModalOpen(false);
    };

    const handleLocalDelete = (id: number) => {
        if (!confirm('Xóa môn học này (Lưu để xác nhận)?')) return;
        setIsDirty(true);
        const target = subjects.find(s => s.id === id);
        if (target?.isNew) {
            setSubjects(prev => prev.filter(s => s.id !== id));
        } else {
            setDeletedIds(prev => [...prev, id]);
            setSubjects(prev => prev.filter(s => s.id !== id));
        }
    };

    const handleBatchCommit = async () => {
        if (!confirm('Lưu tất cả thay đổi?')) return;
        setIsSaving(true);
        try {
            // 1. Delete
            const delPromises = deletedIds.map(id =>
                fetch(`${API_URL}/resources/subjects/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                })
            );

            // 2. Create
            const newItems = subjects.filter(s => s.isNew);
            const createPromises = newItems.map(s => {
                const { id, isNew, isModified, tempId, ...payload } = s;
                return fetch(`${API_URL}/resources/subjects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            });

            // 3. Update
            const modItems = subjects.filter(s => s.isModified && !s.isNew);
            const updatePromises = modItems.map(s => {
                const { id, isNew, isModified, tempId, ...payload } = s;
                return fetch(`${API_URL}/resources/subjects/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
            });

            await Promise.all([...delPromises, ...createPromises, ...updatePromises]);
            alert('Đã lưu thành công!');
            fetchSubjects();
        } catch (e) {
            console.error(e);
            alert('Lỗi khi lưu.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        if (confirm('Hủy bỏ thay đổi?')) fetchSubjects();
    };

    const handleDeleteAll = async () => {
        if (!confirm(`Xóa TOÀN BỘ ${subjects.length} môn học cùng phân công và TKB liên quan? Hành động này không thể hoàn tác.`)) return;
        if (!confirm('Xác nhận lần cuối — bạn chắc chắn muốn xóa hết?')) return;
        try {
            const res = await fetch(`${API_URL}/resources/subjects/all`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) { fetchSubjects(); alert('Đã xóa toàn bộ môn học.'); }
            else alert('Lỗi khi xóa toàn bộ.');
        } catch (e) {
            alert('Lỗi khi xóa toàn bộ.');
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý Môn học</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleDeleteAll}
                        disabled={subjects.length === 0 || isDirty || isSaving}
                        title={isDirty ? 'Lưu hoặc hủy thay đổi trước khi xóa toàn bộ' : undefined}
                        className="border border-red-600 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Xóa toàn bộ
                    </button>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                        onClick={() => { setEditingSubject(null); setIsModalOpen(true); }}
                    >
                        <span>➕</span> Thêm môn học
                    </button>
                </div>
            </div>

            <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-default)] overflow-hidden relative">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold border-b border-[var(--border-default)]">
                        <tr>
                            <th className="px-6 py-4">Mã MH</th>
                            <th className="px-6 py-4">Tên môn học</th>
                            <th className="px-6 py-4">Loại</th>
                            <th className="px-6 py-4">Màu sắc</th>
                            <th className="px-6 py-4 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-[var(--text-secondary)] divide-y divide-[var(--border-light)]">
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-8">Đang tải...</td></tr>
                        ) : subjects.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8">Chưa có môn học nào</td></tr>
                        ) : (
                            subjects.map(sub => (
                                <tr key={sub.id} className={`transition-colors ${sub.isNew ? 'bg-green-50' : sub.isModified ? 'bg-yellow-50' : 'hover:bg-[var(--bg-surface-hover)]'}`}>
                                    <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{sub.code}</td>
                                    <td className="px-6 py-4 font-medium">{sub.name}</td>
                                    <td className="px-6 py-4">
                                        {sub.is_special ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">Đặc biệt</span> : <span className="bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] px-2 py-1 rounded text-xs">Cơ bản</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full border border-[var(--border-default)]" style={{ backgroundColor: sub.color }}></div>
                                            <span className="text-xs text-gray-400 font-mono">{sub.color}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            onClick={() => { setEditingSubject(sub); setIsModalOpen(true); }}
                                        >Sửa</button>
                                        <button className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            onClick={() => handleLocalDelete(sub.id)}
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
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 animate-fade-in-up z-50">
                    <span className="font-bold text-[var(--text-secondary)]">Có thay đổi chưa lưu!</span>
                    <button onClick={handleDiscard} disabled={isSaving} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded-md text-sm font-medium transition">Hủy bỏ</button>
                    <button onClick={handleBatchCommit} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transition flex items-center gap-2">
                        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            )}

            <SubjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleLocalSave}
                initialData={editingSubject}
            />
        </div>
    );
}
