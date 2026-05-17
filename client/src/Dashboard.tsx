import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, CheckCircle, Clock, Calendar, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  startDate: string;
}

interface LinkStat {
  linkLabel: string;
  category: string;
  totalRegistrations: number;
  approved: number;
  pending: number;
  checkedIn: number;
}

interface StatsResponse {
  linkStats: LinkStat[];
  summary: {
    total: number;
    approved: number;
    checkedIn: number;
    recentCheckins: number;
  };
}

const Dashboard: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  const fetchData = async () => {
    try {
      // 1. Fetch Events
      const eventsRes = await axios.get('http://localhost:5001/api/events', authHeader);
      setEvents(eventsRes.data);
      
      if (eventsRes.data.length > 0 && !selectedEventId) {
        setSelectedEventId(eventsRes.data[0].id);
      }
    } catch (err: any) {
      setError('Failed to fetch events.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (eventId: string) => {
    try {
      const statsRes = await axios.get(`http://localhost:5001/api/events/${eventId}/stats`, authHeader);
      setStats(statsRes.data);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchStats(selectedEventId);
      const interval = setInterval(() => fetchStats(selectedEventId), 15000);
      return () => clearInterval(interval);
    }
  }, [selectedEventId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-gray-500 font-medium">Loading your SaaS dashboard...</p>
    </div>
  );

  if (events.length === 0) return (
    <div className="text-center p-20 bg-white rounded-3xl border border-dashed border-gray-200">
      <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900">No Events Found</h3>
      <p className="text-gray-500 mt-2">Create your first event using the API to get started.</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            Event Live Center
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          </h1>
          <p className="text-gray-500 mt-1">Multi-event analytics and real-time arrival tracking</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <Calendar className="w-5 h-5 text-gray-400 ml-2" />
          <select 
            value={selectedEventId || ''} 
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 pr-8"
          >
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </header>
      
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={Users} label="Total Registrations" value={stats.summary.total} color="text-primary" />
            <StatCard icon={CheckCircle} label="Approved" value={stats.summary.approved} color="text-secondary" />
            <StatCard icon={CheckCircle} label="Checked In" value={stats.summary.checkedIn} color="text-indigo-600" />
            <StatCard icon={Clock} label="Last 10m Arrived" value={stats.summary.recentCheckins} color="text-orange-500" />
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Registration Links Analysis</h2>
              <button className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                Manage Links <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="px-8 py-4">Link Label</th>
                    <th className="px-8 py-4">Category</th>
                    <th className="px-8 py-4">Registrations</th>
                    <th className="px-8 py-4">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {stats.linkStats.map((link, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="font-bold text-gray-900">{link.linkLabel}</div>
                        <div className="text-xs text-gray-400">/register/{link.linkLabel.toLowerCase().replace(' ', '-')}</div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                          {link.category}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-gray-900">{link.totalRegistrations}</div>
                        <div className="text-xs text-gray-500">{link.approved} Approved</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                            <div 
                              className="h-full bg-secondary transition-all duration-1000" 
                              style={{ width: `${link.totalRegistrations > 0 ? (link.checkedIn / link.totalRegistrations) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-black text-gray-900">
                            {link.totalRegistrations > 0 ? Math.round((link.checkedIn / link.totalRegistrations) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 transition-all hover:-translate-y-1">
    <div className="flex items-center gap-4 mb-3">
      <div className={`p-3 rounded-2xl bg-gray-50 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-tight">{label}</h3>
    </div>
    <p className={`text-4xl font-black ${color}`}>{value}</p>
  </div>
);

export default Dashboard;