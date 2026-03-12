'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
    { name: 'Tổng quan', href: '/admin', icon: '📊' },
    { name: 'Quản lý Tài khoản', href: '/admin/accounts', icon: '👥' },
    { name: 'Quản lý Lớp học', href: '/admin/classes', icon: '🏫' },
    { name: 'Quản lý Giáo viên', href: '/admin/teachers', icon: '👨‍🏫' },
    { name: 'Quản lý Môn học', href: '/admin/subjects', icon: '📚' },
    { name: 'Phân công CM', href: '/admin/assignments', icon: '📝' },
    { name: 'Phân công & TKB', href: '/admin/timetable', icon: '📅' },
];

export default function AdminSidebar({ onLogout }: { onLogout: () => void }) {
    const pathname = usePathname();

    return (
        <div className="w-64 h-full bg-slate-900 text-white flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-700">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Quản trị
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-medium'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-700">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center space-x-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white py-3 rounded-lg transition-colors border border-red-500/20 hover:border-red-500"
                >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
                </button>
            </div>
        </div>
    );
}
