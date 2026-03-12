
'use client';
import { useState, useEffect } from 'react';
import AccountModal from '../../components/admin/AccountModal';

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

    const fetchAccounts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:4000/users', {
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
            ? `http://localhost:4000/users/${selectedAccount.id}`
            : 'http://localhost:4000/users';
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
            alert(err.message || 'Lỗi khi lưu tài khoản');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return;
        const token = localStorage.getItem('token');
        await fetch(`http://localhost:4000/users/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchAccounts();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Quản lý Tài khoản</h1>
                <button
                    onClick={() => { setSelectedAccount(null); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    + Thêm tài khoản
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Tên đăng nhập</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Vai trò</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Giáo viên liên kết</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">Đang tải...</td></tr>
                        ) : accounts.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-gray-500">Không tìm thấy tài khoản nào.</td></tr>
                        ) : (
                            accounts.map((acc) => (
                                <tr key={acc.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-gray-900">{acc.username}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${acc.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {acc.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600">
                                        {acc.teacher_profile ? `${acc.teacher_profile.full_name} (${acc.teacher_profile.code})` : '-'}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button
                                            onClick={() => { setSelectedAccount(acc); setIsModalOpen(true); }}
                                            className="text-gray-500 hover:text-blue-600 font-medium text-sm"
                                        >
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => handleDelete(acc.id)}
                                            className="text-gray-500 hover:text-red-600 font-medium text-sm"
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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
