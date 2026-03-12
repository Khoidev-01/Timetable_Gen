'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminSidebar from '../components/admin/Sidebar';

export default function AdminLayout({
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
        if (userData.role !== 'ADMIN') {
            router.push('/'); // Or unauthorized page
            return;
        }

        setUser(userData);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/');
    };

    if (!user) return null; // Or loading spinner

    return (
        <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
            <AdminSidebar onLogout={handleLogout} />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
                    <h2 className="text-lg font-semibold text-gray-700">
                        Xin chào, {user.username} 👋
                    </h2>
                    <div className="flex items-center space-x-4">
                        {/* Add notifications or profile dropdown here if needed */}
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
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
