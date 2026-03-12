'use client';
import { useState, useEffect } from 'react';

interface AssignmentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    teacher: { id: string, ho_ten: string } | null;
    onRefresh: () => void; // Refresh parent table
}

export default function AssignmentDetailModal({ isOpen, onClose, teacher, onRefresh }: AssignmentDetailModalProps) {
    const [assignments, setAssignments] = useState<any[]>([]);
    const [duties, setDuties] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Form states for adding/editing
    const [newAssignment, setNewAssignment] = useState({ mon_hoc_id: '', lop_hoc_id: '', so_tiet_tuan: 2 });
    const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

    const [newDuty, setNewDuty] = useState({ ten_nhiem_vu: '', so_tiet_quy_doi: 0 });
    const [editingDutyId, setEditingDutyId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && teacher) {
            fetchDetails();
            fetchOptions();
        }
    }, [isOpen, teacher]);

    const fetchDetails = async () => {
        if (!teacher) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch Assignments and Duties in parallel
            const [assignRes, dutyRes] = await Promise.all([
                fetch(`http://localhost:4000/phan-cong-chuyen-mon/teacher/${teacher.id}`, { headers }),
                fetch(`http://localhost:4000/kiem-nhiem/teacher/${teacher.id}`, { headers })
            ]);

            if (assignRes.ok) setAssignments(await assignRes.json());
            if (dutyRes.ok) setDuties(await dutyRes.json());

        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const [cRes, sRes] = await Promise.all([
                fetch('http://localhost:4000/lop-hoc', { headers }),
                fetch('http://localhost:4000/mon-hoc', { headers })
            ]);
            if (cRes.ok) setClasses(await cRes.json());
            if (sRes.ok) setSubjects(await sRes.json());
        } catch (e) { console.error(e); }
    };

    const handleSaveAssignment = async () => {
        if (!teacher || !newAssignment.mon_hoc_id || !newAssignment.lop_hoc_id) return;
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
            const body = JSON.stringify({
                giao_vien_id: teacher.id,
                ...newAssignment,
                so_tiet_tuan: Number(newAssignment.so_tiet_tuan)
            });

            let res;
            if (editingAssignmentId) {
                // Update
                res = await fetch(`http://localhost:4000/phan-cong-chuyen-mon/${editingAssignmentId}`, {
                    method: 'PATCH',
                    headers,
                    body
                });
            } else {
                // Create
                res = await fetch('http://localhost:4000/phan-cong-chuyen-mon', {
                    method: 'POST',
                    headers,
                    body
                });
            }

            if (res.ok) {
                fetchDetails();
                onRefresh();
                setNewAssignment({ mon_hoc_id: '', lop_hoc_id: '', so_tiet_tuan: 2 });
                setEditingAssignmentId(null);
            } else {
                alert('Lỗi lưu phân công');
            }
        } catch (e) { alert('Lỗi hệ thống'); }
    };

    const startEditAssignment = (item: any) => {
        setNewAssignment({
            mon_hoc_id: item.mon_hoc_id,
            lop_hoc_id: item.lop_hoc_id,
            so_tiet_tuan: item.so_tiet_tuan
        });
        setEditingAssignmentId(item.id);
    };

    const cancelEditAssignment = () => {
        setNewAssignment({ mon_hoc_id: '', lop_hoc_id: '', so_tiet_tuan: 2 });
        setEditingAssignmentId(null);
    };

    const handleDeleteAssignment = async (id: string) => {
        if (!confirm('Xóa phân công này?')) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:4000/phan-cong-chuyen-mon/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDetails();
            onRefresh();
        } catch (e) { alert('Lỗi xóa'); }
    };

    const handleSaveDuty = async () => {
        if (!teacher || !newDuty.ten_nhiem_vu) return;
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
            const body = JSON.stringify({
                giao_vien_id: teacher.id,
                ...newDuty,
                so_tiet_quy_doi: Number(newDuty.so_tiet_quy_doi)
            });

            let res;
            if (editingDutyId) {
                res = await fetch(`http://localhost:4000/kiem-nhiem/${editingDutyId}`, {
                    method: 'PATCH',
                    headers,
                    body
                });
            } else {
                res = await fetch('http://localhost:4000/kiem-nhiem', {
                    method: 'POST',
                    headers,
                    body
                });
            }

            if (res.ok) {
                fetchDetails();
                onRefresh();
                setNewDuty({ ten_nhiem_vu: '', so_tiet_quy_doi: 0 });
                setEditingDutyId(null);
            } else {
                alert('Lỗi lưu kiêm nhiệm');
            }
        } catch (e) { alert('Lỗi hệ thống'); }
    };

    const startEditDuty = (item: any) => {
        setNewDuty({
            ten_nhiem_vu: item.ten_nhiem_vu,
            so_tiet_quy_doi: item.so_tiet_quy_doi
        });
        setEditingDutyId(item.id);
    };

    const cancelEditDuty = () => {
        setNewDuty({ ten_nhiem_vu: '', so_tiet_quy_doi: 0 });
        setEditingDutyId(null);
    };

    const handleDeleteDuty = async (id: string) => {
        if (!confirm('Xóa nhiệm vụ này?')) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:4000/kiem-nhiem/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDetails();
            onRefresh();
        } catch (e) { alert('Lỗi xóa'); }
    };

    if (!isOpen || !teacher) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0">
                    <h3 className="text-xl font-bold text-gray-800">
                        Phân công: <span className="text-blue-600">{teacher.ho_ten}</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Teaching Assignments Section */}
                    <div>
                        <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            📚 Giảng dạy
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 grid grid-cols-4 gap-3 items-end">
                            <div>
                                <label className="text-xs font-medium text-gray-500">Môn học</label>
                                <select className="w-full p-2 border rounded" value={newAssignment.mon_hoc_id} onChange={e => setNewAssignment({ ...newAssignment, mon_hoc_id: e.target.value })}>
                                    <option value="">Chọn môn</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.ten_mon}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500">Lớp</label>
                                <select className="w-full p-2 border rounded" value={newAssignment.lop_hoc_id} onChange={e => setNewAssignment({ ...newAssignment, lop_hoc_id: e.target.value })}>
                                    <option value="">Chọn lớp</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.ten_lop}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500">Số tiết/tuần</label>
                                <input type="number" className="w-full p-2 border rounded" value={newAssignment.so_tiet_tuan} onChange={e => setNewAssignment({ ...newAssignment, so_tiet_tuan: Number(e.target.value) })} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSaveAssignment} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex-1">
                                    {editingAssignmentId ? 'Lưu' : 'Thêm'}
                                </button>
                                {editingAssignmentId && (
                                    <button onClick={cancelEditAssignment} className="bg-gray-400 text-white p-2 rounded hover:bg-gray-500">
                                        Hủy
                                    </button>
                                )}
                            </div>
                        </div>

                        <table className="w-full text-sm text-left border rounded overflow-hidden">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-2 border">Môn</th>
                                    <th className="p-2 border">Lớp</th>
                                    <th className="p-2 border text-center">Tiết/Tuần</th>
                                    <th className="p-2 border text-right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignments.length === 0 ? <tr><td colSpan={4} className="p-3 text-center text-gray-500">Chưa có phân công</td></tr> :
                                    assignments.map(a => (
                                        <tr key={a.id} className="border-t">
                                            <td className="p-2 border">{a.mon_hoc?.ten_mon}</td>
                                            <td className="p-2 border">{a.lop_hoc?.ten_lop}</td>
                                            <td className="p-2 border text-center">{a.so_tiet_tuan}</td>
                                            <td className="p-2 border text-right space-x-2">
                                                <button onClick={() => startEditAssignment(a)} className="text-blue-500 hover:text-blue-700">Sửa</button>
                                                <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-500 hover:text-red-700">Xóa</button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Concurrent Duties Section */}
                    <div>
                        <h4 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            ⭐ Kiêm nhiệm / Chức vụ
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 grid grid-cols-4 gap-3 items-end">
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-gray-500">Tên nhiệm vụ</label>
                                <input className="w-full p-2 border rounded" placeholder="VD: Chủ nhiệm 10A" value={newDuty.ten_nhiem_vu} onChange={e => setNewDuty({ ...newDuty, ten_nhiem_vu: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500">Số tiết quy đổi</label>
                                <input type="number" className="w-full p-2 border rounded" value={newDuty.so_tiet_quy_doi} onChange={e => setNewDuty({ ...newDuty, so_tiet_quy_doi: Number(e.target.value) })} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSaveDuty} className="bg-green-600 text-white p-2 rounded hover:bg-green-700 flex-1">
                                    {editingDutyId ? 'Lưu' : 'Thêm'}
                                </button>
                                {editingDutyId && (
                                    <button onClick={cancelEditDuty} className="bg-gray-400 text-white p-2 rounded hover:bg-gray-500">
                                        Hủy
                                    </button>
                                )}
                            </div>
                        </div>

                        <table className="w-full text-sm text-left border rounded overflow-hidden">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-2 border">Nhiệm vụ</th>
                                    <th className="p-2 border text-center">Tiết quy đổi</th>
                                    <th className="p-2 border text-right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {duties.length === 0 ? <tr><td colSpan={3} className="p-3 text-center text-gray-500">Chưa có kiêm nhiệm</td></tr> :
                                    duties.map(d => (
                                        <tr key={d.id} className="border-t">
                                            <td className="p-2 border">{d.ten_nhiem_vu}</td>
                                            <td className="p-2 border text-center">{d.so_tiet_quy_doi}</td>
                                            <td className="p-2 border text-right space-x-2">
                                                <button onClick={() => startEditDuty(d)} className="text-blue-500 hover:text-blue-700">Sửa</button>
                                                <button onClick={() => handleDeleteDuty(d.id)} className="text-red-500 hover:text-red-700">Xóa</button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium">Đóng</button>
                </div>
            </div>
        </div>
    );
}
