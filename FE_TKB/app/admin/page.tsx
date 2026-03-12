export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Tổng quan hệ thống</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Stat Cards */}
                {[
                    { label: 'Giáo viên', value: '45', color: 'bg-blue-500', icon: '👨‍🏫' },
                    { label: 'Lớp học', value: '24', color: 'bg-green-500', icon: '🏫' },
                    { label: 'Môn học', value: '12', color: 'bg-purple-500', icon: '📚' },
                    { label: 'Phòng học', value: '30', color: 'bg-orange-500', icon: '🚪' },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                                <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
                            </div>
                            <div className={`p-4 rounded-lg ${stat.color} bg-opacity-10 text-2xl`}>
                                {stat.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                    <h3 className="font-semibold text-lg text-gray-800 mb-4">Trạng thái Xếp TKB</h3>
                    <div className="flex items-center justify-center h-full text-gray-400">
                        Chưa có dữ liệu
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                    <h3 className="font-semibold text-lg text-gray-800 mb-4">Hoạt động gần đây</h3>
                    <ul className="space-y-4">
                        <li className="flex items-center text-sm text-gray-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                            Đã cập nhật cấu hình ràng buộc lúc 10:20
                        </li>
                        <li className="flex items-center text-sm text-gray-600">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                            Giáo viên A vừa gửi yêu cầu bận
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
