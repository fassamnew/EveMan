import React, { useState } from 'react';
import { authFetch } from './api';

const CsvImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [results, setResults] = useState<{ successCount: number; errorCount: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('Importing...');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await authFetch('/api/import-csv', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setResults(data);
        setStatus('Import Complete!');
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus('Could not connect to server');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: 'auto', fontFamily: 'sans-serif' }}>
      <h2>Bulk Attendee Import (CSV)</h2>
      <p style={{ fontSize: '0.9em', color: '#666' }}>
        CSV should have columns: <strong>fullName, designation, company, email, phone, category</strong> (Delegate/Media).
      </p>
      
      <input type="file" accept=".csv" onChange={handleFileChange} style={{ marginBottom: '20px' }} />
      <br />
      <button 
        onClick={handleUpload} 
        disabled={!file}
        style={{ padding: '10px 20px', backgroundColor: '#007bff', color: '#fff', border: 'none', cursor: 'pointer' }}
      >
        Upload and Process
      </button>

      {status && <p><strong>Status:</strong> {status}</p>}
      
      {results && (
        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <p style={{ color: 'green' }}>Successfully Imported: {results.successCount}</p>
          <p style={{ color: 'red' }}>Errors: {results.errorCount}</p>
        </div>
      )}
    </div>
  );
};

export default CsvImport;