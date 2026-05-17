import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Event {
  id: string;
  name: string;
}

const CsvImport: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [results, setResults] = useState<{ successCount: number; duplicateCount: number; errorCount: number } | null>(null);

  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get('http://localhost:5001/api/events', authHeader);
        setEvents(res.data);
        if (res.data.length > 0) {
          setSelectedEventId(res.data[0].id);
        }
      } catch {
        setStatus('Failed to load events. Please refresh.');
      }
    };

    fetchEvents();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedEventId) return;
    setStatus('Importing...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', selectedEventId);

    try {
      const response = await axios.post('http://localhost:5001/api/import-csv', formData, authHeader);
      const data = response.data;
      if (response.status >= 200 && response.status < 300) {
        setResults(data);
        setStatus('Import Complete!');
      } else {
        setStatus(`Error: ${data?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatus(err?.response?.data?.error || 'Could not connect to server');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: 'auto', fontFamily: 'sans-serif' }}>
      <h2>Bulk Attendee Import (CSV)</h2>
      <p style={{ fontSize: '0.9em', color: '#666' }}>
        CSV should have columns: <strong>fullName, designation, company, email, phone, category</strong> (Delegate/Media).
      </p>

      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Select Event</label>
      <select
        value={selectedEventId}
        onChange={(e) => setSelectedEventId(e.target.value)}
        style={{ width: '100%', marginBottom: '16px', padding: '8px' }}
      >
        {events.map((event) => (
          <option key={event.id} value={event.id}>{event.name}</option>
        ))}
      </select>
      
      <input type="file" accept=".csv" onChange={handleFileChange} style={{ marginBottom: '20px' }} />
      <br />
      <button 
        onClick={handleUpload} 
        disabled={!file || !selectedEventId}
        style={{ padding: '10px 20px', backgroundColor: '#007bff', color: '#fff', border: 'none', cursor: 'pointer' }}
      >
        Upload and Process
      </button>

      {status && <p><strong>Status:</strong> {status}</p>}
      
      {results && (
        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <p style={{ color: 'green' }}>Successfully Imported: {results.successCount}</p>
          <p style={{ color: '#b45309' }}>Duplicates Skipped: {results.duplicateCount}</p>
          <p style={{ color: 'red' }}>Errors: {results.errorCount}</p>
        </div>
      )}
    </div>
  );
};

export default CsvImport;