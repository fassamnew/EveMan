import React, { useState } from 'react';
import { authFetch } from './api';

const BulkEmail: React.FC = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const sendBulkEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      setStatus('Please provide both subject and message.');
      return;
    }

    setSending(true);
    setStatus('Sending...');
    try {
      const response = await authFetch('/api/bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message })
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || 'Failed to send bulk email.');
        return;
      }

      setStatus('Bulk email sent successfully.');
    } catch {
      setStatus('Could not connect to server.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Bulk Reminder Email</h2>
      <p style={{ color: '#666' }}>Send one message to all registered attendees.</p>

      <div style={{ marginTop: '16px' }}>
        <label htmlFor="bulk-subject" style={{ display: 'block', marginBottom: '8px' }}>Subject</label>
        <input
          id="bulk-subject"
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
        />
      </div>

      <div style={{ marginTop: '16px' }}>
        <label htmlFor="bulk-message" style={{ display: 'block', marginBottom: '8px' }}>Message</label>
        <textarea
          id="bulk-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={8}
          style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
        />
      </div>

      <button
        onClick={sendBulkEmail}
        disabled={sending}
        style={{ marginTop: '16px', padding: '10px 20px', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        {sending ? 'Sending...' : 'Send Bulk Email'}
      </button>

      {status && <p style={{ marginTop: '12px' }}>{status}</p>}
    </div>
  );
};

export default BulkEmail;