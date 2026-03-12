'use client';

export default function TeacherDashboard() {
    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-8 text-white shadow-lg">
                <h1 className="text-3xl font-bold mb-2">Welcome Back!</h1>
                <p className="opacity-90">Wishing you a productive teaching day.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Today's Schedule</h3>
                    <p className="text-gray-500 italic">Coming soon...</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Notifications</h3>
                    <p className="text-gray-500 italic">No new notifications.</p>
                </div>
            </div>
        </div>
    );
}
