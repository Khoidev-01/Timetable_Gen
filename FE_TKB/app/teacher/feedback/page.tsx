'use client';
import { useState, useEffect } from 'react';

interface BusySlot {
    day: number;
    period: number;
    session: number;
}

export default function TeacherFeedbackPage() {
    const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const loadTeacherData = async () => {
            const savedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            if (savedUser && token) {
                const user = JSON.parse(savedUser);
                // Try getting teacherId from user obj (if re-logged in)
                if (user.teacherId) {
                    setTeacherId(user.teacherId);
                    fetchCurrentBusyData(user.teacherId, token);
                } else {
                    // Fallback: Fetch Profile from /auth/profile which returns teacherId
                    try {
                        const res = await fetch(`http://localhost:4000/auth/profile`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const profile = await res.json();
                        if (profile.teacherId) {
                            setTeacherId(profile.teacherId);
                            fetchCurrentBusyData(profile.teacherId, token);

                            // Update localStorage to avoid future fetches
                            const newUser = { ...user, teacherId: profile.teacherId };
                            localStorage.setItem('user', JSON.stringify(newUser));
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        };
        loadTeacherData();
    }, []);

    const fetchCurrentBusyData = async (tid: string, token: string) => {
        try {
            const res = await fetch(`http://localhost:4000/giao-vien/${tid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const teacher = await res.json();
                if (teacher.ngay_nghi_dang_ky) {
                    // Start with existing busy slots
                    // Ensure format is correct array
                    if (Array.isArray(teacher.ngay_nghi_dang_ky)) {
                        setBusySlots(teacher.ngay_nghi_dang_ky);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load busy data", e);
        }
    };

    const toggleSlot = (day: number, session: number, period: number) => {
        setBusySlots(prev => {
            const exists = prev.find(s => s.day === day && s.session === session && s.period === period);
            if (exists) {
                return prev.filter(s => !(s.day === day && s.session === session && s.period === period));
            } else {
                return [...prev, { day, period, session }];
            }
        });
    };

    const isBusy = (day: number, session: number, period: number) => {
        return busySlots.some(s => s.day === day && s.session === session && s.period === period);
    };

    const handleSave = async () => {
        if (!teacherId) return;
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:4000/giao-vien/${teacherId}/busy-time`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ busySlots })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Đã lưu đăng ký thành công!' });
            } else {
                setMessage({ type: 'error', text: 'Lỗi khi lưu dữ liệu.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Lỗi kết nối.' });
        } finally {
            setIsLoading(false);
        }
    };

    const days = [2, 3, 4, 5, 6, 7];
    const periods = [1, 2, 3, 4, 5];

    const renderCell = (day: number, session: number, period: number) => {
        const busy = isBusy(day, session, period);
        return (
            <td
                key={`${day}-${session}-${period}`}
                onClick={() => toggleSlot(day, session, period)}
                className={`border border-gray-200 text-center cursor-pointer transition-colors h-14 w-32 relative
                ${busy ? 'bg-red-100 hover:bg-red-200' : 'bg-white hover:bg-gray-50'}`}
            >
                {busy && (
                    <span className="text-red-600 font-bold text-xs">BẬN</span>
                )}
            </td>
        );
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Đăng Ký Thời Gian Bận</h1>
                    <p className="text-gray-500 mt-1">Chọn các ô tiết mà bạn <span className="font-bold text-red-500">KHÔNG THỂ</span> tham gia giảng dạy. Hệ thống sẽ cố gắng tránh xếp lịch vào các giờ này.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isLoading || !teacherId}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg shadow-emerald-500/30 flex items-center gap-2"
                >
                    {isLoading ? 'Đang lưu...' : 'Lưu Đăng Ký'}
                </button>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead className="bg-gray-100 text-gray-700 text-sm font-bold border-b-2 border-gray-300">
                            <tr>
                                <th className="p-3 border border-gray-300 w-16 text-center bg-gray-100">Buổi</th>
                                <th className="p-3 border border-gray-300 w-12 text-center bg-gray-100">Tiết</th>
                                {days.map(d => (
                                    <th key={d} className="p-3 border border-gray-300 text-center bg-gray-100">
                                        Thứ {d}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-sm text-gray-700 select-none">
                            {/* Morning Session (0) */}
                            {periods.map((p, index) => (
                                <tr key={`sang-${p}`}>
                                    {index === 0 && (
                                        <td rowSpan={5} className="p-2 border border-gray-300 text-center font-bold bg-blue-50 text-blue-800 align-middle">
                                            SÁNG
                                        </td>
                                    )}
                                    <td className="p-2 border border-gray-300 text-center font-bold bg-gray-50">{p}</td>
                                    {days.map(d => renderCell(d, 0, p))}
                                </tr>
                            ))}

                            {/* Divider */}
                            <tr className="bg-gray-200 h-1"><td colSpan={8}></td></tr>

                            {/* Afternoon Session (1) */}
                            {periods.map((p, index) => (
                                <tr key={`chieu-${p}`}>
                                    {index === 0 && (
                                        <td rowSpan={5} className="p-2 border border-gray-300 text-center font-bold bg-orange-50 text-orange-800 align-middle">
                                            CHIỀU
                                        </td>
                                    )}
                                    <td className="p-2 border border-gray-300 text-center font-bold bg-gray-50">{p}</td>
                                    {days.map(d => renderCell(d, 1, p))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-sm text-gray-500 italic">
                * Lưu ý: Việc đăng ký bận quá nhiều có thể ảnh hưởng đến khả năng xếp được thời khóa biểu phù hợp. Vui lòng cân nhắc.
            </div>
        </div>
    );
}
