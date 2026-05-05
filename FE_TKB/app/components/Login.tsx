'use client';

import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import { LogIn, RefreshCw, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import ThemeToggle from './ThemeToggle';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCaptcha = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/captcha`, { method: 'POST' });
      const data = await res.json();
      setCaptchaSvg(data.img);
      setCaptchaSessionId(data.sessionId);
    } catch (err) {
      console.error('Failed to fetch captcha', err);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, captchaCode, captchaSessionId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Đăng nhập thất bại');
      }

      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
      fetchCaptcha();
      setCaptchaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-base)] transition-colors">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
      </div>

      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="MiKiTimetable" width={72} height={72} className="rounded-2xl shadow-xl mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
            MiKiTimetable
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Hệ thống xếp thời khóa biểu tự động</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl border border-[var(--border-default)] p-8 transition-colors">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6 text-center">
            Đăng nhập
          </h2>

          {error && (
            <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-3 rounded-xl mb-5 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Tài khoản</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]
                  text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                  focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all"
                placeholder="Nhập mã giáo viên hoặc admin"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]
                    text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                    focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Mã xác nhận</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]
                    text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                    focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all"
                  placeholder="Nhập mã bên cạnh"
                  required
                />
                <div className="relative group">
                  <div
                    className="h-full w-28 rounded-xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-base)]
                      cursor-pointer flex items-center justify-center shrink-0"
                    onClick={fetchCaptcha}
                    title="Click để làm mới"
                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                  />
                  <div className="absolute inset-0 rounded-xl bg-black/30 opacity-0 group-hover:opacity-100
                    flex items-center justify-center transition-opacity cursor-pointer"
                    onClick={fetchCaptcha}
                  >
                    <RefreshCw size={16} className="text-white" />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700
                text-white font-semibold py-3 rounded-xl transition-all flex justify-center items-center gap-2
                shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  Đăng nhập
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[var(--text-muted)] text-xs mt-6">
          MiKiTimetable v1.0 &mdash; Hệ thống xếp thời khóa biểu tự động
        </p>
      </div>
    </div>
  );
}
