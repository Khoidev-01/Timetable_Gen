'use client';
import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';

interface ConstraintConfig {
    id: string;
    ma_rang_buoc: string;
    ten_rang_buoc: string;
    loai: 'HARD' | 'SOFT';
    trong_so: number;
    is_active: boolean;
    mo_ta: string;
}

export default function ConfigurationPage() {
    const [constraints, setConstraints] = useState<ConstraintConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchConstraints();
    }, []);

    const fetchConstraints = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/cau-hinh-rang-buoc`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Sort: Hard first, then by Code
                data.sort((a: ConstraintConfig, b: ConstraintConfig) => {
                    if (a.loai !== b.loai) return a.loai === 'HARD' ? -1 : 1;
                    return a.ma_rang_buoc.localeCompare(b.ma_rang_buoc);
                });
                setConstraints(data);
            }
        } catch (error) {
            console.error("Failed to fetch constraints", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleActive = async (id: string, currentState: boolean) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/cau-hinh-rang-buoc/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_active: !currentState })
            });

            if (res.ok) {
                setConstraints(prev => prev.map(c =>
                    c.id === id ? { ...c, is_active: !currentState } : c
                ));
            }
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

    const handleWeightChange = async (id: string, newWeight: number) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/cau-hinh-rang-buoc/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ trong_so: newWeight })
            });

            if (res.ok) {
                setConstraints(prev => prev.map(c =>
                    c.id === id ? { ...c, trong_so: newWeight } : c
                ));
            }
        } catch (error) {
            console.error("Failed to update weight", error);
        }
    };

    const hardConstraints = constraints.filter(c => c.loai === 'HARD');
    const softConstraints = constraints.filter(c => c.loai === 'SOFT');

    return (
        <div className="space-y-8 pb-20">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Cấu hình thuật toán & Ràng buộc</h1>

            {isLoading ? (
                <div className="text-center py-10 text-[var(--text-muted)]">Đang tải cấu hình...</div>
            ) : (
                <>
                    {/* Hard Constraints Section */}
                    <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-default)] overflow-hidden">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-red-800">Ràng buộc Cứng (Hard Constraints)</h2>
                                <p className="text-sm text-red-600 mt-1">Các điều kiện bắt buộc phải thỏa mãn. Nếu vi phạm, thời khóa biểu sẽ không hợp lệ.</p>
                            </div>
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">{hardConstraints.length} Rules</span>
                        </div>

                        <div className="divide-y divide-[var(--border-light)]">
                            {hardConstraints.map(c => (
                                <div key={c.id} className="p-6 hover:bg-[var(--bg-surface-hover)] transition flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono font-bold text-gray-400 bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded">{c.ma_rang_buoc}</span>
                                            <h3 className="font-semibold text-[var(--text-primary)]">{c.ten_rang_buoc}</h3>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)]">{c.mo_ta}</p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Hard constraints usually shouldn't be disabled effortlessly, but provided for flexibility */}
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={c.is_active}
                                                onChange={() => handleToggleActive(c.id, c.is_active)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-surface)] after:border-[var(--border-default)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                            <span className="ml-3 text-sm font-medium text-[var(--text-secondary)] w-16 text-right">
                                                {c.is_active ? 'Bật' : 'Tắt'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Soft Constraints Section */}
                    <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-default)] overflow-hidden">
                        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-blue-800">Ràng buộc Mềm (Soft Constraints)</h2>
                                <p className="text-sm text-blue-600 mt-1">Các điều kiện ưu tiên. Vi phạm sẽ bị trừ điểm Fitness nhưng TKB vẫn hợp lệ.</p>
                            </div>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{softConstraints.length} Rules</span>
                        </div>

                        <div className="divide-y divide-[var(--border-light)]">
                            {softConstraints.map(c => (
                                <div key={c.id} className="p-6 hover:bg-[var(--bg-surface-hover)] transition flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-mono font-bold text-gray-400 bg-[var(--bg-surface-hover)] px-1.5 py-0.5 rounded">{c.ma_rang_buoc}</span>
                                            <h3 className="font-semibold text-[var(--text-primary)]">{c.ten_rang_buoc}</h3>
                                        </div>
                                        <p className="text-sm text-[var(--text-secondary)]">{c.mo_ta}</p>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {/* Weight Input */}
                                        <div className="flex flex-col items-end">
                                            <label className="text-xs font-medium text-[var(--text-muted)] mb-1">Trọng số (Penalty)</label>
                                            <input
                                                type="number"
                                                className="w-20 text-right p-1.5 border border-[var(--border-default)] rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                value={c.trong_so}
                                                // Update on Blur to minimize writes
                                                onBlur={(e) => handleWeightChange(c.id, parseInt(e.target.value))}
                                                onChange={(e) => {
                                                    // Optimistic UI update for input responsiveness
                                                    const val = parseInt(e.target.value);
                                                    setConstraints(prev => prev.map(x => x.id === c.id ? { ...x, trong_so: val } : x));
                                                }}
                                            />
                                        </div>

                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={c.is_active}
                                                onChange={() => handleToggleActive(c.id, c.is_active)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-surface)] after:border-[var(--border-default)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            <span className="ml-3 text-sm font-medium text-[var(--text-secondary)] w-16 text-right">
                                                {c.is_active ? 'Bật' : 'Tắt'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
