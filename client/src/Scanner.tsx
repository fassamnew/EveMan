import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import { QrCode, CheckCircle, XCircle, Loader2, Calendar } from 'lucide-react';

interface Event {
  id: string;
  name: string;
}

const Scanner: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [attendee, setAttendee] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get('http://localhost:5001/api/usher/events', authHeader);
        setEvents(res.data);
        if (res.data.length > 0) {
          setSelectedEventId(res.data[0].id);
        }
      } catch (err) {
        setError('Failed to fetch events for scanner.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    if (!selectedEventId || scanResult) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(onScanSuccess, (err) => {});

    function onScanSuccess(decodedText: string) {
      setScanResult(decodedText);
      verifyAttendee(decodedText);
      scanner.clear();
    }

    return () => {
      scanner.clear().catch(err => {});
    };
  }, [selectedEventId, scanResult]);

  const verifyAttendee = async (attendeeId: string) => {
    try {
      const response = await axios.post(
        `http://localhost:5001/api/events/${selectedEventId}/verify/${attendeeId}`,
        {},
        authHeader
      );
      setAttendee(response.data.attendee);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed');
      setAttendee(null);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setAttendee(null);
    setError(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-gray-500">Initializing Scanner...</p>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="text-center">
        <h1 className="text-3xl font-black text-gray-900 flex items-center justify-center gap-3">
          <QrCode className="w-8 h-8 text-primary" />
          Onsite Entry Scan
        </h1>
        <p className="text-gray-500 mt-1">Select an event and scan badge QR code</p>
      </header>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
        <Calendar className="w-5 h-5 text-gray-400 ml-2" />
        <select 
          value={selectedEventId || ''} 
          onChange={(e) => {
            setSelectedEventId(e.target.value);
            resetScanner();
          }}
          className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 w-full"
        >
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden p-6">
        {!scanResult && selectedEventId && (
          <div id="reader" className="w-full rounded-2xl overflow-hidden border border-gray-100"></div>
        )}

        {error && (
          <div className="text-center space-y-4 py-10">
            <XCircle className="w-20 h-20 text-red-500 mx-auto" />
            <h3 className="text-2xl font-black text-red-600">ACCESS DENIED</h3>
            <p className="text-gray-600 font-medium px-10">{error}</p>
            <button 
              onClick={resetScanner}
              className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all"
            >
              Scan Next
            </button>
          </div>
        )}

        {attendee && (
          <div className="text-center space-y-6 py-10 animate-in zoom-in duration-300">
            <CheckCircle className="w-20 h-20 text-secondary mx-auto" />
            <div>
              <h3 className="text-3xl font-black text-secondary">WELCOME</h3>
              <p className="text-xl font-bold text-gray-900 mt-2">{attendee.fullName}</p>
              <p className="text-gray-500">{attendee.designation} at {attendee.company}</p>
            </div>
            
            <div className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-black uppercase">
              {attendee.linkLabel}
            </div>

            <button 
              onClick={resetScanner}
              className="w-full py-4 bg-secondary text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
            >
              Ready for Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;