'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Login from '../components/Login';

export default function LoginPage() {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user.role === 'ADMIN') {
          router.push('/admin');
          return;
        }
        if (user.role === 'TEACHER') {
          router.push('/teacher');
          return;
        }
        localStorage.clear();
      } catch (error) {
        console.error('Invalid user data', error);
        localStorage.clear();
      }
    }
    const readyTimer = window.setTimeout(() => setIsChecking(false), 0);
    return () => window.clearTimeout(readyTimer);
  }, [router]);

  const handleLoginSuccess = (user: { role?: string }) => {
    localStorage.setItem('user', JSON.stringify(user));
    router.push(user.role === 'ADMIN' ? '/admin' : '/teacher');
  };

  if (isChecking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-base)] text-[var(--text-muted)]">
        <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--bg-base)]">
      <Login onLoginSuccess={handleLoginSuccess} />
    </main>
  );
}
