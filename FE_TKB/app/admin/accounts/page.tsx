
'use client';
import { useState, useEffect, useMemo } from 'react';
import { toast } from '@/lib/toast';
import AccountModal from '../../components/admin/AccountModal';
import { API_URL } from '@/lib/api';
import { TableSkeleton, EmptyState } from '../../components/ui/States';
import { Users } from 'lucide-react';
import { FilterChips, Pager, usePaged } from '../../components/ui/Paging';

type RoleFilter = 'ALL' | 'ADMIN' | 'TEACHER';

interface User {
    id: string;
    username: string;
    role: string; // TEACHER, ADMIN
    teacher_profile?: { full_name: string; code: string };
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<User[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

    const filtered = useMemo(
        () => (roleFilter === 'ALL' ? accounts : accounts.filter((a) => a.role === roleFilter)),
        [accounts, roleFilter],
    );
    const paged = usePaged(filtered);

    const roleOptions = [
        { value: 'ALL' as RoleFilter, label: 'Tất cả', count: accounts.length },
        { value: 'ADMIN' as RoleFilter, label: 'Quản trị viên', count: accounts.filter((a) => a.role === 'ADMIN').length },
        { value: 'TEACHER' as RoleFilter, label: 'Giáo viên', count: accounts.filter((a) => a.role === 'TEACHER').length },
    ];

    const chooseRole = (value: RoleFilter) => {
        setRoleFilter(value);
        paged.setPage(1);
    };

    const fetchAccounts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleSave = async (data: any) => {
        const token = localStorage.getItem('token');
        const url = selectedAccount
            ? `${API_URL}/users/${selectedAccount.id}`
            : `${API_URL}/users`;
        const method = selectedAccount ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            fetchAccounts();
        } else {
            const err = await res.json();
            toast(err.message || 'Lỗi khi lưu tài khoản', "error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return;
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchAccounts();
    };

    const handleDeleteAll = async () => {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const otherCount = accounts.filter(a => a.id !== currentUser.id).length;
        if (otherCount === 0) { toast('Không có tài khoản nào khác để xóa.', "error"); return; }
        if (!confirm(`Xóa TOÀN BỘ ${otherCount} tài khoản (giữ lại admin hiện tại)? Hành động này không thể hoàn tác.`)) return;
        if (!confirm('Xác nhận lần cuối - bạn chắc chắn muốn xóa hết?')) return;
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/users/all?except_id=${encodeURIComponent(currentUser.id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) { fetchAccounts(); toast('Đã xóa toàn bộ tài khoản.', "success"); }
        else toast('Lỗi khi xóa toàn bộ.', "error");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý Tài khoản</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleDeleteAll}
                        disabled={accounts.length === 0}
                        className="border border-red-600 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Xóa toàn bộ
                    </button>
                    <button
                        onClick={() => { setSelectedAccount(null); setIsModalOpen(true); }}
                        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                        + Thêm tài khoản
                    </button>
                </div>
            </div>

            <FilterChips options={roleOptions} value={roleFilter} onChange={chooseRole} label="Lọc theo vai trò" />

            <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] shadow-sm border border-[var(--border-default)] overflow-hidden">
                <table className="data-table w-full text-left border-collapse">
                  <colgroup>
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                    <thead className="bg-[var(--bg-surface-hover)] border-b">
                        <tr>
                            <th className="p-4 text-xs font-semibold text-[var(--text-muted)] uppercase text-center">Tên đăng nhập</th>
                            <th className="p-4 text-xs font-semibold text-[var(--text-muted)] uppercase text-center">Vai trò</th>
                            <th className="p-4 text-xs font-semibold text-[var(--text-muted)] uppercase text-center">Giáo viên liên kết</th>
                            <th className="p-4 text-xs font-semibold text-[var(--text-muted)] uppercase text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]">
                        {isLoading ? (
                            <TableSkeleton rows={5} cols={4} />
                        ) : accounts.length === 0 ? (
                            <tr><td colSpan={4}>
                                <EmptyState icon={<Users size={22} strokeWidth={1.8} />} title="Chưa có tài khoản nào" hint="Tạo tài khoản đăng nhập cho quản trị viên và giáo viên." />
                            </td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={4}>
                                <EmptyState icon={<Users size={22} strokeWidth={1.8} />} title="Không có tài khoản nào với vai trò này" hint="Chọn vai trò khác hoặc bấm Tất cả." />
                            </td></tr>
                        ) : (
                            paged.visible.map((acc, idx) => (
                                <tr key={acc.id} style={{ animationDelay: `${idx * 30}ms` }} className="animate-rise hover:bg-[var(--bg-surface-hover)] transition-colors">
                                    <td className="p-4 font-medium text-[var(--text-primary)]">{acc.username}</td>
                                    <td className="p-4 text-[var(--text-secondary)]">
                                        {acc.role === 'ADMIN' ? 'Quản trị viên' : 'Giáo viên'}
                                    </td>
                                    <td className="p-4 text-[var(--text-secondary)]">
                                        {acc.teacher_profile ? `${acc.teacher_profile.full_name} (${acc.teacher_profile.code})` : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button type="button"
                                            onClick={() => { setSelectedAccount(acc); setIsModalOpen(true); }}
                                            className="row-action"
                                        >
                                            Sửa
                                        </button>
                                        <button type="button"
                                            onClick={() => handleDelete(acc.id)}
                                            className="row-action row-action--danger"
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {!isLoading && <Pager paged={paged} noun="tài khoản" label="Phân trang tài khoản" />}
            </div>

            <AccountModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={selectedAccount}
            />
        </div>
    );
}
