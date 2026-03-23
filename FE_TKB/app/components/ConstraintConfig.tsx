'use client';

import React, { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

interface Constraint {
    id: string;
    ma_rang_buoc: string;
    ten_rang_buoc: string;
    loai: 'HARD' | 'SOFT';
    trong_so: number;
    is_active: boolean;
    mo_ta: string;
}

interface ConstraintConfigProps {
    onClose: () => void;
}

export default function ConstraintConfig({ onClose }: ConstraintConfigProps) {
    const [constraints, setConstraints] = useState<Constraint[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchConstraints();
    }, []);

    const fetchConstraints = async () => {
        try {
            const res = await fetch(`${API_URL}/cau-hinh-rang-buoc`);
            if (res.ok) {
                const data = await res.json();
                setConstraints(data);
            }
        } catch (error) {
            console.error("Failed to fetch constraints:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await fetch(`${API_URL}/cau-hinh-rang-buoc/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !currentStatus })
            });
            // Optimistic update
            setConstraints(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
        } catch (error) {
            console.error("Failed to toggle constraint:", error);
            alert("Lỗi khi cập nhật trạng thái!");
        }
    };

    const handleWeightChange = async (id: string, newWeight: number) => {
        // Debounce could be good here, but for simplicity let's update on blur or use a local state for input
        // For now, simple direct update on change (be careful with rapid API calls)
        // Better: Update UI state immediately, API call onBlur
    };

    const updateWeightApi = async (id: string, weight: number) => {
        try {
            await fetch(`${API_URL}/cau-hinh-rang-buoc/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trong_so: weight })
            });
        } catch (error) {
            console.error("Failed to update weight:", error);
        }
    };

    if (isLoading) return <div className="p-4">Đang tải cấu hình...</div>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-700 text-lg">Cấu Hình Ràng Buộc Thuật Toán</h3>
                        <p className="text-sm text-slate-500">Bật/tắt hoặc điều chỉnh trọng số các luật xếp thời khóa biểu</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                        </svg>
                    </button>
                </div>

                <div className="p-0 overflow-y-auto bg-gray-50 flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-4 border-b text-xs font-bold text-slate-500 uppercase">Mã</th>
                                <th className="p-4 border-b text-xs font-bold text-slate-500 uppercase">Tên Ràng Buộc</th>
                                <th className="p-4 border-b text-xs font-bold text-slate-500 uppercase">Loại</th>
                                <th className="p-4 border-b text-xs font-bold text-slate-500 uppercase text-center">Trạng Thái</th>
                                <th className="p-4 border-b text-xs font-bold text-slate-500 uppercase text-right">Trọng Số</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {constraints.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-sm font-mono text-slate-400">{c.ma_rang_buoc}</td>
                                    <td className="p-4">
                                        <div className="font-medium text-slate-700">{c.ten_rang_buoc}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{c.mo_ta}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${c.loai === 'HARD' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {c.loai}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleToggle(c.id, c.is_active)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${c.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${c.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        {c.loai === 'SOFT' ? (
                                            <input
                                                type="number"
                                                defaultValue={c.trong_so}
                                                onBlur={(e) => updateWeightApi(c.id, parseInt(e.target.value))}
                                                className="w-20 px-2 py-1 text-right text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                                            />
                                        ) : (
                                            <span className="text-gray-400 text-sm italic">Cố định</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
