'use client';

import React, { useState, useEffect } from 'react';

interface LoginProps {
    onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [captchaCode, setCaptchaCode] = useState('');
    const [captchaSvg, setCaptchaSvg] = useState('');
    const [captchaSessionId, setCaptchaSessionId] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchCaptcha = async () => {
        try {
            // updated port
            const res = await fetch('http://localhost:4000/auth/captcha', { method: 'POST' });
            const data = await res.json();
            setCaptchaSvg(data.img);
            setCaptchaSessionId(data.sessionId);
        } catch (err) {
            console.error("Failed to fetch captcha", err);
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
            const res = await fetch('http://localhost:4000/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    captchaCode,
                    captchaSessionId
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Login failed');
            }

            const data = await res.json();
            // Store token if needed (localStorage/cookie)
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user)); // Optional constraint

            onLoginSuccess(data.user);
        } catch (err: any) {
            setError(err.message);
            // Refresh captcha on error
            fetchCaptcha();
            setCaptchaCode('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Hệ thống tạo thời khóa biểu</h2>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tài khoản</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium placeholder:text-gray-400"
                            placeholder="Nhập mã giáo viên hoặc admin"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium placeholder:text-gray-400"
                            placeholder="••••••"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mã xác nhận (Captcha)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={captchaCode}
                                onChange={(e) => setCaptchaCode(e.target.value)}
                                className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium placeholder:text-gray-400"
                                placeholder="Nhập mã bên cạnh"
                                required
                            />
                            <div
                                className="bg-slate-100 rounded-lg overflow-hidden border border-slate-300 cursor-pointer w-32 flex items-center justify-center shrink-0"
                                onClick={fetchCaptcha}
                                title="Click to refresh"
                                dangerouslySetInnerHTML={{ __html: captchaSvg }}
                            >
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors flex justify-center items-center"
                    >
                        {isLoading ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : 'Đăng nhập'}
                    </button>
                </form>
            </div>
        </div>
    );
}
