import React, { useEffect, useState } from 'react';

interface Stat {
  category: string;
  total: number;
  checkedIn: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const totalAttendees = stats.reduce((acc, curr) => acc + curr.total, 0);
  const totalCheckedIn = stats.reduce((acc, curr) => acc + curr.checkedIn, 0);

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">NH Event Live Monitor</h1>
            <p className="text-gray-500 mt-2">Real-time attendance tracking and registration stats</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <span className="flex items-center text-sm font-medium text-gray-600">
              <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              Live Tracking Enabled
            </span>
          </div>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Total Registered</h3>
            <p className="text-5xl font-black text-primary mt-2">{totalAttendees}</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Total Checked In</h3>
            <p className="text-5xl font-black text-secondary mt-2">{totalCheckedIn}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Detail by Category</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-8 py-4">Category</th>
                  <th className="px-8 py-4">Registered</th>
                  <th className="px-8 py-4">Checked In</th>
                  <th className="px-8 py-4">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {stats.length > 0 ? stats.map(stat => (
                  <tr key={stat.category} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-5 font-semibold text-gray-900">{stat.category}</td>
                    <td className="px-8 py-5">{stat.total}</td>
                    <td className="px-8 py-5 text-secondary font-medium">{stat.checkedIn}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-secondary transition-all duration-1000" 
                            style={{ width: `${stat.total > 0 ? (stat.checkedIn / stat.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold min-w-[3rem]">
                          {stat.total > 0 ? Math.round((stat.checkedIn / stat.total) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-10 text-center text-gray-400">No data available yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;