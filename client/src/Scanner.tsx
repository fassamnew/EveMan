import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const Scanner: React.FC = () => {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [attendee, setAttendee] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);

    function onScanSuccess(decodedText: string) {
      setScanResult(decodedText);
      verifyAttendee(decodedText);
      scanner.clear(); // Stop scanning after success
    }

    function onScanFailure(error: any) {
      // console.warn(`Code scan error = ${error}`);
    }

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, []);

  const verifyAttendee = async (id: string) => {
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:5001/api/verify/${id}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setAttendee(data);
        setError(null);
      } else {
        setError(data.error || 'Verification failed');
        setAttendee(null);
      }
    } catch (err) {
      setError('Could not connect to server');
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setAttendee(null);
    setError(null);
    window.location.reload(); // Simplest way to restart the scanner instance
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>QR Entry Scanner</h1>
      
      {!scanResult && <div id="reader" style={{ width: '100%', maxWidth: '500px', margin: 'auto' }}></div>}

      {error && (
        <div style={{ color: 'red', margin: '20px', padding: '10px', border: '1px solid red' }}>
          <h3>Error: {error}</h3>
          <button onClick={resetScanner}>Scan Again</button>
        </div>
      )}

      {attendee && (
        <div style={{ margin: '20px', padding: '20px', border: '2px solid green', borderRadius: '10px', background: '#e9f7ef' }}>
          <h2 style={{ color: '#28a745' }}>SUCCESS: CHECKED IN</h2>
          <p><strong>Name:</strong> {attendee.fullName}</p>
          <p><strong>Category:</strong> {attendee.category}</p>
          <p><strong>Company:</strong> {attendee.company}</p>
          <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
          <button onClick={resetScanner} style={{ padding: '10px 20px', marginTop: '10px' }}>Next Scan</button>
        </div>
      )}
    </div>
  );
};

export default Scanner;