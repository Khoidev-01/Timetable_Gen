'use client';

import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import { LogIn, RefreshCw, Eye, EyeOff, MailCheck, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

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

  // Bước 2: mã 6 số gửi về email. `challenge` là vé máy chủ cấp sau khi mật khẩu đúng.
  const [step, setStep] = useState<'PASSWORD' | 'EMAIL_REQUIRED' | 'OTP_REQUIRED'>('PASSWORD');
  const [challenge, setChallenge] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const finishLogin = (data: any) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    onLoginSuccess(data.user);
  };

  const postJson = async (path: string, body: unknown) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Máy chủ chặn gửi mã quá dày: khóa nút "Gửi lại" đúng số giây nó báo
      const wait = res.status === 429 ? Number(String(data.message ?? '').match(/(\d+) giây/)?.[1] ?? 0) : 0;
      if (wait > 0) setResendIn(wait);
      throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || 'Yêu cầu thất bại');
    }
    return data;
  };

  const backToPassword = () => {
    setStep('PASSWORD');
    setChallenge('');
    setOtp('');
    setEmail('');
    setError('');
    fetchCaptcha();
    setCaptchaCode('');
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const data = await postJson('/auth/otp/request', { challenge, email });
      setChallenge(data.challenge);
      setEmailHint(data.emailHint);
      setStep('OTP_REQUIRED');
      setResendIn(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      const data = await postJson('/auth/otp/request', { challenge });
      setChallenge(data.challenge);
      setOtp('');
      setResendIn(60);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      finishLogin(await postJson('/auth/otp/verify', { challenge, otp }));
    } catch (err: any) {
      setError(err.message);
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

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
      if (data.step === 'OTP_REQUIRED' || data.step === 'EMAIL_REQUIRED') {
        setChallenge(data.challenge);
        setEmailHint(data.emailHint ?? '');
        setStep(data.step);
        setResendIn(data.step === 'OTP_REQUIRED' ? 60 : 0);
        return;
      }
      finishLogin(data);
    } catch (err: any) {
      setError(err.message);
      fetchCaptcha();
      setCaptchaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 bg-[var(--bg-base)] transition-colors">
      {/* Background decoration - single accent, restrained */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--accent)]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl" />
      </div>
      <div className="grain-overlay" aria-hidden />

      <div
        className={`relative w-full animate-rise transition-[max-width] ${
          step === 'OTP_REQUIRED' ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/favicon.svg?v=2" alt="MiKiTimetable" width={72} height={72} className="mb-4 rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]" />
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            MiKiTimetable
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Hệ thống xếp thời khóa biểu tự động</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] border border-[var(--border-default)] p-5 transition-colors sm:p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6 text-center">
            {step === 'PASSWORD' ? 'Đăng nhập' : step === 'EMAIL_REQUIRED' ? 'Khai email nhận mã' : 'Nhập mã đăng nhập'}
          </h2>

          {error && (
            <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-3 rounded-[var(--radius-md)] mb-5 text-sm font-medium">
              {error}
            </div>
          )}

          {step === 'EMAIL_REQUIRED' && (
            <form onSubmit={handleEmail} className="space-y-5" data-step="email">
              <p className="text-sm text-[var(--text-secondary)]">
                Tài khoản chưa có email. Hãy khai email của bạn: hệ thống gửi mã 6 số tới đó để xác nhận, và từ lần sau
                mã đăng nhập sẽ gửi về email này.
              </p>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)]
                    text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                    focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none transition-all"
                  placeholder="ten@truong.edu.vn"
                  required
                />
              </div>
              <button type="submit" disabled={isLoading} className="tactile w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] font-semibold py-3 rounded-[var(--radius-md)] flex justify-center items-center gap-2 shadow-[var(--shadow-md)] disabled:opacity-60 disabled:pointer-events-none">
                {isLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><MailCheck size={18} /> Gửi mã</>}
              </button>
              <button type="button" onClick={backToPassword} className="flex w-full items-center justify-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <ArrowLeft size={14} /> Quay lại
              </button>
            </form>
          )}

          {step === 'OTP_REQUIRED' && (
            <form onSubmit={handleOtp} className="space-y-5" data-step="otp">
              <p className="whitespace-nowrap text-center text-[clamp(8px,2.45vw,13px)] text-[var(--text-secondary)]">
                Mã 6 số đã được gửi tới <strong className="text-[var(--text-primary)]">{emailHint}</strong>. Mã có hiệu lực 5 phút.
              </p>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Mã đăng nhập</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)]
                    text-center text-2xl font-semibold tracking-[0.5em] text-[var(--text-primary)] placeholder:tracking-normal placeholder:text-base placeholder:font-normal placeholder:text-[var(--text-muted)]
                    focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none transition-all"
                  placeholder="Nhập 6 chữ số"
                  required
                />
              </div>
              <button type="submit" disabled={isLoading || otp.length !== 6} className="tactile w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] font-semibold py-3 rounded-[var(--radius-md)] flex justify-center items-center gap-2 shadow-[var(--shadow-md)] disabled:opacity-60 disabled:pointer-events-none">
                {isLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><LogIn size={18} /> Xác nhận</>}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={backToPassword} className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                  <ArrowLeft size={14} /> Quay lại
                </button>
                <button type="button" onClick={handleResend} disabled={resendIn > 0} className="text-[var(--accent)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--text-muted)] disabled:no-underline">
                  {resendIn > 0 ? `Gửi lại mã sau ${resendIn}s` : 'Gửi lại mã'}
                </button>
              </div>
            </form>
          )}

          {step === 'PASSWORD' && (
          <form onSubmit={handleLogin} className="space-y-5" data-step="password">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Tài khoản</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)]
                  text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                  focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none transition-all"
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
                  className="w-full px-4 py-2.5 pr-11 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)]
                    text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                    focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none transition-all"
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
                  className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-base)]
                    text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                    focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] outline-none transition-all"
                  placeholder="Nhập mã bên cạnh"
                  required
                />
                <div className="relative group">
                  <div
                    className="h-full w-28 rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-default)] bg-[var(--bg-base)]
                      cursor-pointer flex items-center justify-center shrink-0"
                    onClick={fetchCaptcha}
                    title="Click để làm mới"
                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                  />
                  <div className="absolute inset-0 rounded-[var(--radius-md)] bg-black/30 opacity-0 group-hover:opacity-100
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
              className="tactile w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)]
                text-[var(--accent-contrast)] font-semibold py-3 rounded-[var(--radius-md)] flex justify-center items-center gap-2
                shadow-[var(--shadow-md)] disabled:opacity-60 disabled:pointer-events-none"
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
          )}
        </div>
      </div>
    </div>
  );
}
