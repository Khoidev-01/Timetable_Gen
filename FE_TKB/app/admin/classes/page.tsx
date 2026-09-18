'use client';
import { useState, useEffect, useMemo } from 'react';
import { toast } from '@/lib/toast';
import ClassModal from '../../components/admin/ClassModal';
import { API_URL } from '@/lib/api';
import Select from '@/app/components/ui/Select';
import { TableSkeleton, EmptyState } from '../../components/ui/States';
import { FilterChips, Pager, usePaged } from '../../components/ui/Paging';
import { School, DoorOpen } from 'lucide-react';

interface ClassData {
  id: string; name: string; grade_level: number; main_session: number;
  fixed_room?: { name: string }; homeroom_teacher?: { full_name: string };
}
interface Room {
  id: number; name: string; type: RoomType; floor: number; capacity: number;
}

// Đúng bảy loại mà CSDL nhận (enum RoomType). Bản cũ có 'LAB' và 'SPECIALIZED' — không loại
// nào tồn tại, nên tạo phòng thí nghiệm từ đây bị CSDL từ chối và phòng Tin/sân hiện cột trống.
type RoomType = 'CLASSROOM' | 'LAB_PHYSICS' | 'LAB_CHEM' | 'LAB_BIO' | 'LAB_IT' | 'YARD' | 'MULTI_PURPOSE';
const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  CLASSROOM: 'Phòng thường',
  LAB_PHYSICS: 'Phòng thí nghiệm Vật lý',
  LAB_CHEM: 'Phòng thí nghiệm Hóa học',
  LAB_BIO: 'Phòng thí nghiệm Sinh học',
  LAB_IT: 'Phòng Tin học',
  YARD: 'Sân thể dục',
  MULTI_PURPOSE: 'Phòng đa năng',
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
      <div className="w-full max-w-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] shadow-xl p-6 space-y-4">
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
            <Select
              size="sm"
              value={form.type}
              onChange={value => setForm(f => ({ ...f, type: value as RoomType }))}
              options={(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((value) => ({ value, label: ROOM_TYPE_LABELS[value] }))}
            />
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
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50">
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
  const [gradeFilter, setGradeFilter] = useState<'ALL' | number>('ALL');

  // Khoi lay tu chinh du lieu, nen truong co khoi nao thi hien khoi do
  const gradeOptions = useMemo(() => {
    const grades = [...new Set(classes.map((c) => c.grade_level))].sort((a, b) => a - b);
    return [
      { value: 'ALL' as const, label: 'Tất cả', count: classes.length },
      ...grades.map((grade) => ({ value: grade, label: `Khối ${grade}`, count: classes.filter((c) => c.grade_level === grade).length })),
    ];
  }, [classes]);
  // Xoa het muc cua nhom dang loc thi nhom do bien mat khoi danh sach nut; quay ve Tat ca
  const activeGrade = gradeOptions.some((o) => o.value === gradeFilter) ? gradeFilter : 'ALL';
  const filteredClasses = useMemo(
    () => (activeGrade === 'ALL' ? classes : classes.filter((c) => c.grade_level === activeGrade)),
    [classes, activeGrade],
  );
  const pagedClasses = usePaged(filteredClasses);

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
    if (res.ok) fetchClasses(); else toast('Xóa thất bại', "error");
  };

  const handleDeleteAllClasses = async () => {
    if (!confirm(`Xóa TOÀN BỘ ${classes.length} lớp học cùng phân công và TKB liên quan?`)) return;
    if (!confirm('Xác nhận lần cuối - không thể hoàn tác!')) return;
    const res = await fetch(`${API_URL}/organization/classes/all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) fetchClasses(); else toast('Lỗi khi xóa', "error");
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
  const [floorFilter, setFloorFilter] = useState<'ALL' | number>('ALL');

  const floorOptions = useMemo(() => {
    const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
    return [
      { value: 'ALL' as const, label: 'Tất cả', count: rooms.length },
      ...floors.map((floor) => ({ value: floor, label: `Tầng ${floor}`, count: rooms.filter((r) => r.floor === floor).length })),
    ];
  }, [rooms]);
  // Xoa het muc cua nhom dang loc thi nhom do bien mat khoi danh sach nut; quay ve Tat ca
  const activeFloor = floorOptions.some((o) => o.value === floorFilter) ? floorFilter : 'ALL';
  const filteredRooms = useMemo(
    () => (activeFloor === 'ALL' ? rooms : rooms.filter((r) => r.floor === activeFloor)),
    [rooms, activeFloor],
  );
  const pagedRooms = usePaged(filteredRooms);

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
    if (res.ok) fetchRooms(); else toast('Xóa thất bại. Phòng có thể đang được dùng trong TKB', "error");
  };

  const handleDeleteAllRooms = async () => {
    if (!confirm(`Xóa TOÀN BỘ ${rooms.length} phòng học?`)) return;
    if (!confirm('Xác nhận lần cuối - không thể hoàn tác!')) return;
    const res = await fetch(`${API_URL}/resources/rooms/all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) fetchRooms(); else toast('Lỗi khi xóa', "error");
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý Lớp học & Phòng học</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-default)]">
        {([{ key: 'classes', label: `Lớp học (${classes.length})` }, { key: 'rooms', label: `Phòng học (${rooms.length})` }] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px
              ${tab === t.key ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Lớp học ── */}
      {tab === 'classes' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            options={gradeOptions}
            value={activeGrade}
            onChange={(value) => { setGradeFilter(value); pagedClasses.setPage(1); }}
            label="Lọc lớp theo khối"
          />
          <div className="flex justify-end gap-2">
            <button onClick={handleDeleteAllClasses} disabled={classes.length === 0}
              className="border border-red-600 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Xóa toàn bộ
            </button>
            <button onClick={() => { setEditingClass(null); setIsModalOpen(true); }}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm">
              + Thêm lớp học
            </button>
          </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] overflow-hidden">
            <table className="data-table w-full text-left border-collapse">
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold border-b border-[var(--border-default)]">
                <tr>
                  <th className="px-6 py-4 text-center">Tên lớp</th>
                  <th className="px-6 py-4 text-center">Khối</th>
                  <th className="px-6 py-4 text-center">Buổi</th>
                  <th className="px-6 py-4 text-center">Phòng cố định</th>
                  <th className="px-6 py-4 text-center">GV Chủ nhiệm</th>
                  <th className="px-6 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)] divide-y divide-[var(--border-light)]">
                {classLoading ? (
                  <TableSkeleton rows={5} cols={6} />
                ) : classes.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState icon={<School size={22} strokeWidth={1.8} />} title="Chưa có lớp học nào" hint="Thêm lớp thủ công hoặc nhập từ Excel ở trang Phân công." />
                  </td></tr>
                ) : pagedClasses.visible.map((cls, idx) => (
                  <tr key={cls.id} style={{ animationDelay: `${idx * 30}ms` }} className="animate-rise hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{cls.name}</td>
                    <td className="px-6 py-4">{cls.grade_level}</td>
                    <td className="px-6 py-4">{cls.main_session === 0 ? 'Sáng' : 'Chiều'}</td>
                    <td className="px-6 py-4">{cls.fixed_room?.name ?? <span className="text-[var(--text-muted)] italic">--</span>}</td>
                    <td className="px-6 py-4">{cls.homeroom_teacher?.full_name ?? <span className="text-[var(--text-muted)] italic">--</span>}</td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" className="row-action"
                        onClick={() => { setEditingClass(cls); setIsModalOpen(true); }}>Sửa</button>
                      <button type="button" className="row-action row-action--danger"
                        onClick={() => handleDeleteClass(cls.id)}>Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!classLoading && <Pager paged={pagedClasses} noun="lớp" label="Phân trang lớp học" />}
          </div>

          <ClassModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveClass} initialData={editingClass} />
        </>
      )}

      {/* ── TAB: Phòng học ── */}
      {tab === 'rooms' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            options={floorOptions}
            value={activeFloor}
            onChange={(value) => { setFloorFilter(value); pagedRooms.setPage(1); }}
            label="Lọc phòng theo tầng"
          />
          <div className="flex justify-end gap-2">
            <button onClick={handleDeleteAllRooms} disabled={rooms.length === 0}
              className="border border-red-600 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Xóa toàn bộ
            </button>
            <button onClick={() => { setRoomDialog('new' as any); setRoomDialogOpen(true); }}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm">
              + Thêm phòng học
            </button>
          </div>
          </div>

          <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border-default)] overflow-hidden">
            <table className="data-table w-full text-left border-collapse">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead className="bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-semibold border-b border-[var(--border-default)]">
                <tr>
                  <th className="px-6 py-4 text-center">Tên phòng</th>
                  <th className="px-6 py-4 text-center">Loại</th>
                  <th className="px-6 py-4 text-center">Tầng</th>
                  <th className="px-6 py-4 text-center">Sức chứa</th>
                  <th className="px-6 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)] divide-y divide-[var(--border-light)]">
                {roomLoading ? (
                  <TableSkeleton rows={5} cols={5} />
                ) : rooms.length === 0 ? (
                  <tr><td colSpan={5}>
                    <EmptyState icon={<DoorOpen size={22} strokeWidth={1.8} />} title="Chưa có phòng học nào" hint="Thêm phòng học để thuật toán phân bổ phòng cho các tiết." />
                  </td></tr>
                ) : pagedRooms.visible.map(r => (
                  <tr key={r.id} className="hover:bg-[var(--bg-surface-hover)]">
                    <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{r.name}</td>
                    <td className="px-6 py-4">{ROOM_TYPE_LABELS[r.type]}</td>
                    <td className="px-6 py-4 text-center">{r.floor}</td>
                    <td className="px-6 py-4 text-center">{r.capacity}</td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" className="row-action"
                        onClick={() => { setRoomDialog(r); setRoomDialogOpen(true); }}>Sửa</button>
                      <button type="button" className="row-action row-action--danger"
                        onClick={() => handleDeleteRoom(r.id)}>Xóa</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!roomLoading && <Pager paged={pagedRooms} noun="phòng" label="Phân trang phòng học" />}
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
