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

  if (loading) return <div>Loading dashboard...</div>;

  const totalAttendees = stats.reduce((acc, curr) => acc + curr.total, 0);
  const totalCheckedIn = stats.reduce((acc, curr) => acc + curr.checkedIn, 0);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Event Live Monitor</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', background: '#f8f9fa' }}>
          <h3>Total Registered</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalAttendees}</p>
        </div>
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', background: '#e9f7ef' }}>
          <h3>Total Checked In</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{totalCheckedIn}</p>
        </div>
      </div>

      <h2>Detail by Category</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#eee', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>Category</th>
            <th style={{ padding: '12px' }}>Registered</th>
            <th style={{ padding: '12px' }}>Checked In</th>
            <th style={{ padding: '12px' }}>Attendance %</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(stat => (
            <tr key={stat.category} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '12px' }}>{stat.category}</td>
              <td style={{ padding: '12px' }}>{stat.total}</td>
              <td style={{ padding: '12px' }}>{stat.checkedIn}</td>
              <td style={{ padding: '12px' }}>
                {stat.total > 0 ? Math.round((stat.checkedIn / stat.total) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;