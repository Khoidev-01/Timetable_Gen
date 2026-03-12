'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const teacherMenuItems = [
    { name: 'Tổng quan', href: '/teacher', icon: '🏠' },
    { name: 'Thời khóa biểu', href: '/teacher/schedule', icon: '📅' },
    { name: 'Đăng ký bận', href: '/teacher/feedback', icon: '⏳' },
    { name: 'Đổi mật khẩu', href: '/teacher/profile', icon: '🔒' },
];

function TeacherSidebar({ onLogout }: { onLogout: () => void }) {
    const pathname = usePathname();
    return (
        <div className="w-64 h-full bg-emerald-900 text-white flex flex-col shadow-xl">
            <div className="p-6 border-b border-emerald-700">
                <h1 className="text-2xl font-bold text-white">
                    Giáo Viên
                </h1>
                <p className="text-emerald-300 text-sm">Cổng thông tin</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {teacherMenuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 font-medium'
                                : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'
                                }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-emerald-700">
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

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (!token || !savedUser) {
            router.push('/');
            return;
        }

        const userData = JSON.parse(savedUser);
        if (userData.role !== 'TEACHER') {
            router.push('/');
            return;
        }

        setUser(userData);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/');
    };

    if (!user) return null;

    return (
        <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
            <TeacherSidebar onLogout={handleLogout} />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
                    <h2 className="text-lg font-semibold text-gray-700">
                        Xin chào, Thầy/Cô {user.ho_ten} 👋
                    </h2>
                    <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                            {user.username[0].toUpperCase()}
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
