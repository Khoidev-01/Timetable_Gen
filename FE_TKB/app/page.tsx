'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from "./components/Login";

export default function Home() {
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
        } else if (user.role === 'TEACHER') {
          router.push('/teacher');
        } else {
          // Unknown role, clear
          localStorage.clear();
          setIsChecking(false);
        }
      } catch (e) {
        console.error("Invalid user data", e);
        localStorage.clear();
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // When Login succeeds, redirect immediately
  const handleLoginSuccess = (user: any) => {
    localStorage.setItem('user', JSON.stringify(user));
    if (user.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/teacher');
    }
  };

  if (isChecking) return <div className="h-screen flex items-center justify-center bg-white text-gray-500">Checking session...</div>;

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <Login onLoginSuccess={handleLoginSuccess} />
    </main>
  );
}
