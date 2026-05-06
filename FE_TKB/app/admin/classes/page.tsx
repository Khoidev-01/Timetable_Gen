'use client';
import { useState, useEffect } from 'react';
import ClassModal from '../../components/admin/ClassModal';
import { API_URL } from '@/lib/api';

interface ClassData {
  id: string; name: string; grade_level: number; main_session: number;
  fixed_room?: { name: string }; homeroom_teacher?: { full_name: string };
}
interface Room {
  id: number; name: string; type: 'CLASSROOM' | 'LAB' | 'SPECIALIZED'; floor: number; capacity: number;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  CLASSROOM: 'Phòng thường', LAB: 'Phòng thí nghiệm', SPECIALIZED: 'Phòng chuyên',
};
const ROOM_TYPE_COLORS: Record<string, string> = {
  CLASSROOM: 'bg-blue-100 text-blue-700', LAB: 'bg-green-100 text-green-700', SPECIALIZED: 'bg-purple-100 text-purple-700',
};

function RoomFormDialog({ room, onClose, onSave }: {
  room: Room | null; onClose: () => void; onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: room?.name ?? '', type: room?.type ?? 'CLASSROOM', floor: room?.floor ?? 1, capacity: room?.capacity ?? 45 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); }
    catch (ex: any) { setErr(ex.message || 'Lỗi lưu'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-[var(--bg-surface)] shadow-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">{room ? 'Sửa phòng học' : 'Thêm phòng học'}</h3>
        {err && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{err}</p>}
        <form onSubmit={handle} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tên phòng</label>
            <input required className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VD: 101, Lab Lý..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Loại phòng</label>
            <select className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
              <option value="CLASSROOM">Phòng thường</option>
              <option value="LAB">Phòng thí nghiệm</option>
              <option value="SPECIALIZED">Phòng chuyên</option>
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tầng</label>
              <input type="number" min={1} max={10} required className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={form.floor} onChange={e => setForm(f => ({ ...f, floor: +e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Sức chứa</label>
              <input type="number" min={1} required className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] text-sm">Hủy</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClassesPage() {
  const [tab, setTab] = useState<'classes' | 'rooms'>('classes');
  const token = () => localStorage.getItem('token') ?? '';

  // ── Classes ──
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [classLoading, setClassLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);

  const fetchClasses = async () => {
    setClassLoading(true);
    const res = await fetch(`${API_URL}/organization/classes`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setClasses(await res.json());
    setClassLoading(false);
  };
  useEffect(() => { fetchClasses(); }, []);

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lớp này?')) return;
    const res = await fetch(`${API_URL}/organization/classes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) fetchClasses(); else alert('Xóa thất bại');
  };

  const handleDeleteAllClasses = async () => {
    if (!confirm(`Xóa TOÀN BỘ ${classes.length} lớp học cùng phân công và TKB liên quan?`)) return;
    if (!confirm('Xác nhận lần cuối — không thể hoàn tác!')) return;
    const res = await fetch(`${API_URL}/organization/classes/all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) fetchClasses(); else alert('Lỗi khi xóa');
  };

  const handleSaveClass = async (data: any) => {
    const url = editingClass ? `${API_URL}/organization/classes/${editingClass.id}` : `${API_URL}/organization/classes`;
    const res = await fetch(url, { method: editingClass ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(data) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Lỗi khi lưu'); }
    fetchClasses();
  };

  // ── Rooms ──
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomDialog, setRoomDialog] = useState<Room | null | 'new'>('new' as any);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);

  const fetchRooms = async () => {
    setRoomLoading(true);
    const res = await fetch(`${API_URL}/resources/rooms`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setRooms(await res.json());
    setRoomLoading(false);
  };
  useEffect(() => { fetchRooms(); }, []);

  const handleSaveRoom = async (data: any) => {
    const editing = roomDialog !== 'new' ? roomDialog as Room : null;
    const url = editing ? `${API_URL}/resources/rooms/${editing.id}` : `${API_URL}/resources/rooms`;
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(data) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Lỗi khi lưu'); }
    fetchRooms();
  };

  const handleDeleteRoom = async (id: number) => {
    if (!confirm('Xóa phòng học này?')) return;
    const res = await fetch(`${API_URL}/resources/rooms/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) fetchRooms(); else alert('Xóa thất bại — phòng có thể đang được dùng trong TKB');
  };

  const handleDeleteAllRooms = async () => {
    if (!confirm(`Xóa TOÀN BỘ ${rooms.length} phòng học?`)) return;
    if (!confirm('Xác nhận lần cuối — không thể hoàn tác!')) return;
    const res = await fetch(`${API_URL}/resources/rooms/all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) fetchRooms(); else alert('Lỗi khi xóa');
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý Lớp học & Phòng học</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)]">
        {([{ key: 'classes', label: `Lớp học (${classes.length})` }, { key: 'rooms', label: `Phòng học (${rooms.length})` }] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px
              ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Lớp học ── */}
      {tab === 'classes' && (
        <>
          <div className="flex justify-end gap-2">
            <button onClick={handleDeleteAllClasses} disabled={classes.length === 0}
              className="border border-red-600 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Xóa toàn bộ
            </button>
            <button onClick={() => { setEditingClass(null); setIsModalOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
              + Thêm lớp học
            </button>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold border-b border-[var(--border-default)]">
                <tr>
                  <th className="px-6 py-4">Tên lớp</th>
                  <th className="px-6 py-4">Khối</th>
                  <th className="px-6 py-4">Buổi</th>
                  <th className="px-6 py-4">Phòng cố định</th>
                  <th className="px-6 py-4">GV Chủ nhiệm</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)] divide-y divide-[var(--border-light)]">
                {classLoading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-[var(--text-muted)]">Đang tải...</td></tr>
                ) : classes.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-[var(--text-muted)]">Chưa có lớp học nào</td></tr>
                ) : classes.map(cls => (
                  <tr key={cls.id} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{cls.name}</td>
                    <td className="px-6 py-4"><span className="bg-[var(--bg-surface-hover)] px-2 py-0.5 rounded text-xs font-bold">{cls.grade_level}</span></td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls.main_session === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
                        {cls.main_session === 0 ? 'Sáng' : 'Chiều'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{cls.fixed_room?.name ?? <span className="text-[var(--text-muted)] italic">--</span>}</td>
                    <td className="px-6 py-4">{cls.homeroom_teacher?.full_name ?? <span className="text-[var(--text-muted)] italic">--</span>}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        onClick={() => { setEditingClass(cls); setIsModalOpen(true); }}>Sửa</button>
                      <button className="text-red-600 hover:text-red-800 text-sm font-medium"
                        onClick={() => handleDeleteClass(cls.id)}>Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ClassModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveClass} initialData={editingClass} />
        </>
      )}

      {/* ── TAB: Phòng học ── */}
      {tab === 'rooms' && (
        <>
          <div className="flex justify-end gap-2">
            <button onClick={handleDeleteAllRooms} disabled={rooms.length === 0}
              className="border border-red-600 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Xóa toàn bộ
            </button>
            <button onClick={() => { setRoomDialog('new' as any); setRoomDialogOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
              + Thêm phòng học
            </button>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold border-b border-[var(--border-default)]">
                <tr>
                  <th className="px-6 py-4">Tên phòng</th>
                  <th className="px-6 py-4">Loại</th>
                  <th className="px-6 py-4 text-center">Tầng</th>
                  <th className="px-6 py-4 text-center">Sức chứa</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)] divide-y divide-[var(--border-light)]">
                {roomLoading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-[var(--text-muted)]">Đang tải...</td></tr>
                ) : rooms.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-[var(--text-muted)]">Chưa có phòng học nào</td></tr>
                ) : rooms.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{r.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ROOM_TYPE_COLORS[r.type]}`}>
                        {ROOM_TYPE_LABELS[r.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">{r.floor}</td>
                    <td className="px-6 py-4 text-center">{r.capacity}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        onClick={() => { setRoomDialog(r); setRoomDialogOpen(true); }}>Sửa</button>
                      <button className="text-red-600 hover:text-red-800 text-sm font-medium"
                        onClick={() => handleDeleteRoom(r.id)}>Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {roomDialogOpen && (
        <RoomFormDialog
          room={roomDialog === 'new' as any ? null : roomDialog as Room}
          onClose={() => setRoomDialogOpen(false)}
          onSave={handleSaveRoom}
        />
      )}
    </div>
  );
}
